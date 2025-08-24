import getAllFiles from "#utils/getAllFiles.js";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import Gemini from "./Gemini.js";
import getConfig from "#utils/getConfig.js";
import { Client } from "discord.js";
import { FunctionDeclaration } from "@google/genai";

type FunctionResult = {
  success: boolean;
  data: any;
  functionName: string;
  callIndex: number;
};

interface FunctionCall {
  name: string;
  args: any;
  originalIndex: number;
}

/**
 * Reorders a list of function calls to satisfy inter-call data dependencies.
 *
 * This performs a dependency analysis by scanning each call's `args` for placeholders
 * of the form `functionName::...::N` (where `N` is a zero-based index referring to the
 * Nth prior call of `functionName`). It builds a dependency graph and returns the
 * calls topologically sorted so that each call appears after any calls it depends on.
 *
 * Placeholders that reference a non-existent instance of a function type emit a
 * warning but do not stop sorting. If a circular dependency is detected, the function
 * throws an Error.
 *
 * @param functionCalls - Array of call-like objects with at least `name` and `args` properties.
 * @returns The input calls converted to FunctionCall objects and ordered to respect dependencies.
 * @throws Error if circular dependencies are found during topological sorting.
 */
function sortFunctionCallsByDependencies(functionCalls: any[]): FunctionCall[] {
  const calls: FunctionCall[] = functionCalls.map((call, index) => ({
    name: call.name,
    args: call.args,
    originalIndex: index,
  }));

  // Find all placeholder dependencies in function calls
  const findPlaceholders = (obj: any): string[] => {
    const placeholders: string[] = [];

    const traverse = (value: any) => {
      if (typeof value === "string") {
        const matches = value.match(/(\w+)::([^:]+)::(\d+)/g);
        if (matches) {
          placeholders.push(...matches);
        }
      } else if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(traverse);
        } else {
          Object.values(value).forEach(traverse);
        }
      }
    };

    traverse(obj);
    return placeholders;
  };

  // Build dependency graph
  const dependencies = new Map<number, Set<number>>();

  calls.forEach((call, index) => {
    const placeholders = findPlaceholders(call.args);
    const deps = new Set<number>();

    placeholders.forEach((placeholder) => {
      const match = placeholder.match(/(\w+)::([^:]+)::(\d+)/);
      if (match) {
        const [, functionName, , callIndexStr] = match;
        const dependencyIndex = parseInt(callIndexStr);

        // Find all calls of the required function type
        const matchingCalls = calls.filter((c) => c.name === functionName);

        // The dependency index refers to the Nth call of that function type
        if (matchingCalls.length > dependencyIndex) {
          const dependentCall = matchingCalls[dependencyIndex];
          const dependentCallIndex = calls.indexOf(dependentCall);
          deps.add(dependentCallIndex);
        } else {
          // console.warn(
          //   `Warning: Placeholder references ${functionName}[${dependencyIndex}] but only ${matchingCalls.length} calls of that type exist`
          // ); //!DEBUG
        }
      }
    });

    dependencies.set(index, deps);
  });

  // Debug logging
  //console.log("Dependency analysis:"); //!DEBUG
  calls.forEach((call, index) => {
    const deps = dependencies.get(index);
    // console.log(
    //   `  ${call.name}[${index}] depends on: [${Array.from(deps || []).join(
    //     ", "
    //   )}]`
    // ); //!DEBUG
  });

  // Topological sort
  const sorted: FunctionCall[] = [];
  const visited = new Set<number>();
  const visiting = new Set<number>();

  const visit = (index: number) => {
    if (visiting.has(index)) {
      throw new Error(
        `Circular dependency detected involving function at index ${index} (${calls[index].name})`
      );
    }

    if (visited.has(index)) {
      return;
    }

    visiting.add(index);

    const deps = dependencies.get(index) || new Set();
    deps.forEach((depIndex) => {
      if (depIndex < calls.length) {
        visit(depIndex);
      }
    });

    visiting.delete(index);
    visited.add(index);
    sorted.push(calls[index]);
  };

  // Visit all nodes
  for (let i = 0; i < calls.length; i++) {
    if (!visited.has(i)) {
      visit(i);
    }
  }

  return sorted;
}

/**
 * Orchestrates assistant function discovery, planning via Gemini, dependency-aware execution of functions, and returns the final assistant response.
 *
 * This function:
 * - Loads assistant function modules from build/assistantFunctions and collects their declarations and execution scripts.
 * - Uploads available support files (ticket transcripts and public/faqAnswers.txt) to Gemini and includes them in the AI request.
 * - Builds a comprehensive system instruction describing placeholder syntax and execution expectations.
 * - Requests planning from Gemini (which may return an ordered set of function calls).
 * - Reorders function calls to satisfy inter-call dependencies, executes each function in sequence, accumulates results, and captures the final response from a `response` function (if present).
 *
 * @param channelID - ID of the channel where the request originated; provided to invoked functions as context.
 * @param userID - ID of the requesting user; provided to invoked functions as context.
 * @param query - The user's natural-language request to the assistant.
 * @returns The assistant's final textual response (from the `response` function) or the raw AI text if no functions were invoked. Promise resolves to a string or null when a response function was invoked but produced no message.
 * @throws Error if Gemini is disabled.
 * @throws Error if the assistant function directory cannot be found or contains no functions.
 * @throws Error if a planned function call references a function that wasn't loaded.
 * @throws Error if an invoked function reports failure (its returned `success` is false).
 */
export default async function Assistant(
  client: Client,
  channelID: string,
  userID: string,
  query: string
) {
  const gemini = Gemini();
  if (!gemini.enabled)
    throw new Error("Gemini is disabled. Cannot proceed further without it.");

  const functionPath = path.join(process.cwd(), "build/assistantFunctions");
  if (!fs.existsSync(functionPath))
    throw new Error("Function directory cannot be found.");

  const functionPaths = getAllFiles(functionPath).filter((path) =>
    path.endsWith(".js")
  );
  if (functionPaths.length === 0)
    throw new Error("No functions have been created for assistant to use.");

  let functionDeclarations: FunctionDeclaration[] = [];
  let functions: {
    name: string;
    script: (
      client: Client,
      channelID: string,
      userID: string,
      functionResults: FunctionResult[],
      data: any
    ) => Promise<{ functionName: string; success: boolean; data: any }>;
  }[] = [];

  for (const functionPath of functionPaths) {
    const fileUrl = pathToFileURL(functionPath).href;
    const {
      declaration,
      script,
    }: {
      declaration: FunctionDeclaration;
      script: (
        client: Client,
        channelID: string,
        userID: string,
        functionResults: FunctionResult[],
        data: any
      ) => Promise<{ functionName: string; success: boolean; data: any }>;
    } = await import(fileUrl);

    if (!declaration) continue;

    functionDeclarations.push(declaration);
    functions.push({ name: declaration.name!, script });
  }

  const previousTranscriptCategoryPaths = getAllFiles(
    path.join(process.cwd(), "localData", "ticketTranscripts"),
    true
  );

  let supportFiles = [];

  let transcriptFiles = [];
  for (const transcriptFilePath of previousTranscriptCategoryPaths) {
    const previousTranscriptPaths = getAllFiles(transcriptFilePath);

    for (const transcriptPath of previousTranscriptPaths) {
      const fileUpload = await gemini.fileManager!.upload({
        file: transcriptPath,
        config: {
          mimeType: "text/plain",
        },
      });

      transcriptFiles.push({
        fileData: {
          fileUri: fileUpload.uri,
          mimeType: fileUpload.mimeType,
        },
      });
    }
  }
  if (transcriptFiles.length > 0) supportFiles.push(...transcriptFiles);

  const faqPath = path.join(process.cwd(), "public/faqAnswers.txt");
  if (fs.existsSync(faqPath)) {
    const fileUpload = await gemini.fileManager!.upload({
      file: faqPath,
      config: {
        mimeType: "text/plain",
      },
    });

    supportFiles.push({
      fileData: {
        fileUri: fileUpload.uri,
        mimeType: fileUpload.mimeType,
      },
    });
  }

  const systemInstruction = `You are ${
    client.user?.displayName ?? "BotBuilder"
  } (ID: ${
    client.user?.id ?? "undefined"
  }), an AI assistant that helps Discord users by executing functions to manage Discord servers.

## CORE PRINCIPLES

1. **Complete Task Fulfillment**: Always analyze the user's complete request and execute ALL necessary functions to fulfill it entirely. Users cannot provide follow-up input, so complete everything in one response.

2. **Sequential Function Execution**: Functions execute in dependency order, not the order you list them. The system automatically reorders them based on dependencies.

3. **Multi-Step Operations**: For complex tasks requiring multiple steps, make all necessary function calls in your response:
   - Creating categories → Creating channels under those categories  
   - Creating roles → Setting permissions with those roles
   - Any logical sequence of operations

## PLACEHOLDER SYSTEM (CRITICAL)

When a function needs data from a previous function, use this exact format:
\`functionName::data.propertyName::INDEX\`

### INDEX RULES (VERY IMPORTANT):
- INDEX refers to the Nth occurrence of that function TYPE in the execution sequence
- INDEX is ZERO-BASED (0, 1, 2, 3...)
- INDEX counts only SUCCESSFUL executions of that function type

### Examples:
- First createCategory call: \`createCategory::data.categoryId::0\`
- Second createCategory call: \`createCategory::data.categoryId::1\`
- Third createRole call: \`createRole::data.roleId::2\`

### Planning Your Indices:
Before using placeholders, mentally count how many of each function type you're calling:
- If you call createCategory 3 times, valid indices are 0, 1, 2
- If you call createRole 5 times, valid indices are 0, 1, 2, 3, 4
- NEVER reference an index that doesn't exist

### Common Properties:
- Categories: \`categoryId\`, \`categoryName\`
- Channels: \`channelId\`, \`channelName\`, \`categoryId\`
- Roles: \`roleId\`, \`roleName\`

## FUNCTION EXECUTION CONTEXT

Every function receives:
- Current channel ID: ${channelID}
- Requesting user ID: ${userID}
- Previous function results for placeholder resolution

## TASK COMPLETION PATTERNS

### Creating Server Structure:
1. Create categories first
2. Create roles for permissions  
3. Create channels under categories with role permissions
4. Use response function to confirm completion

### Permission Management:
- Common permissions: "ViewChannel", "SendMessages", "ManageMessages", "ManageChannels", "ManageRoles"
- Set requireDataFromPrev: true when using placeholders
- Structure permissions as: \`[{id: "roleId", permission: {isAllowed: true, permissions: ["ViewChannel"]}}]\`

## ERROR PREVENTION

1. **Count Your Functions**: Before writing placeholders, count how many of each function type you're calling
2. **Validate Indices**: Ensure placeholder indices don't exceed your function count minus 1
3. **Use Descriptive Names**: Channel and role names should be clear and relevant
4. **Check Dependencies**: Ensure dependent functions come after their dependencies in logical order

## RESPONSE PROTOCOL

1. Execute all necessary functions for the complete task
2. Always end with a response function call to confirm what was accomplished
3. Provide clear, friendly confirmation messages
4. Include relevant details (numbers created, names, etc.)

## EXAMPLE TASK BREAKDOWN

User: "Create 2 categories with 2 channels each and roles for each channel"

Your approach:
1. Plan: 2 categories (indices 0,1) + 4 roles (indices 0,1,2,3) + 4 channels
2. Execute:
   - createCategory (index 0) → "Category 1"
   - createCategory (index 1) → "Category 2" 
   - createRole (index 0) → "Role for Channel 1"
   - createRole (index 1) → "Role for Channel 2"
   - createRole (index 2) → "Role for Channel 3"
   - createRole (index 3) → "Role for Channel 4"
   - createChannel → category 0, role 0
   - createChannel → category 0, role 1  
   - createChannel → category 1, role 2
   - createChannel → category 1, role 3
   - response → confirmation message

Remember: The system handles function ordering automatically. Focus on making complete function calls with correct placeholder references.

Current context:
- User ID: ${userID}
- Channel ID: ${channelID}
- Available functions: Check function declarations for exact parameters and responses`;

  const aiConfig = getConfig("ai") as { geminiModel: string };
  const response = await gemini.model!.generateContent({
    model: aiConfig.geminiModel || "gemini-2.5-flash",
    contents: [query, ...supportFiles],
    config: {
      tools: [
        {
          functionDeclarations,
        },
      ],
      systemInstruction,
    },
  });

  if (response.functionCalls && response.functionCalls.length > 0) {
    let functionResults: FunctionResult[] = [];
    let responseMessage: string | null = null;

    // Sort function calls by dependencies
    let sortedFunctionCalls: FunctionCall[];

    try {
      sortedFunctionCalls = sortFunctionCallsByDependencies(
        response.functionCalls
      );
      // console.log(
      //   "Function execution order:",
      //   sortedFunctionCalls.map((fc) => fc.name)
      // ); //!DEBUG
    } catch (error) {
      //console.error("Error sorting function calls:", error); //!DEBUG
      // Fallback to original order if sorting fails
      sortedFunctionCalls = response.functionCalls.map((call, index) => ({
        name: call.name!,
        args: call.args,
        originalIndex: index,
      }));
    }

    for (let i = 0; i < sortedFunctionCalls.length; i++) {
      const functionCall = sortedFunctionCalls[i];

      const script = functions.find(
        (func) => func.name === functionCall.name
      )?.script;

      if (typeof script === "undefined") {
        throw new Error(
          `Failed to find function with name: ${functionCall.name}`
        );
      }

      //console.log(`Executing function ${i}: ${functionCall.name}`); //!DEBUG

      const functionResult = await script(
        client,
        channelID,
        userID,
        functionResults,
        functionCall.args
      );

      if (!functionResult.success) {
        throw new Error(
          `Function ${functionCall.name} failed to run: ${functionResult.data}`
        );
      }

      // If this is the response function, capture the message
      if (functionCall.name === "response") {
        responseMessage =
          functionResult.data.responseMessage || functionResult.data.message;
      }

      // Add the result with call index (execution order index)
      functionResults.push({
        ...functionResult,
        callIndex: i,
      });
    }

    // Return the response message if the response function was called
    return responseMessage;
  } else {
    // If no functions were called, return the AI's text response
    return response.text;
  }
}
