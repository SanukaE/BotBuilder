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
  callIndex: number; // Add index to track order of calls
};

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

  const systemInstruction = `As an AI assistant who's name is ${
    client.user?.displayName ?? "BotBuilder"
  } with ID ${
    client.user?.id ?? "undefined"
  }, you assist Discord users by calling functions. Each function has access to the channel ID and user ID of the user requesting the task. 

IMPORTANT: You can and should make MULTIPLE function calls in a single response when needed to complete complex tasks. All functions are executed sequentially, and the system waits for one function to complete before proceeding to the next. The user doesn't have access to replying back to you. So try your best to complete the task without asking for user's input in something.

For tasks that require multiple steps (like creating a category and then multiple channels), make all necessary function calls in your response. For example:
- If asked to create a category and channels, first call createCategory, then call createChannel for each channel needed
- If a function requires a value from a previous function, use the format "functionName::dataValue::<INDEX>" where functionName is the name of the function, dataValue is the property to get from the returned data, and INDEX is the position of the function call (0-indexed). For example: "createCategory::data.categoryId::0" refers to the first createCategory call.
- If the user asked a question try your best to answer it from the provided ticket transcripts & FAQ files
- For placeholders in text just leave the placeholder as it is and not use {} or anything representing that it's a placeholder

Always analyze the user's request completely and make all necessary function calls to fulfill their entire request.

When you complete a task, you should use the 'response' function to provide a confirmation message about what was accomplished. This message will be sent back to the user as a response to their command.

Information about the user making the request:
User ID: ${userID}
Current Channel ID: ${channelID}
`;

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
    console.log("Functions to Call:", response.functionCalls); //!Debug
    let functionResults: FunctionResult[] = [];
    let responseMessage: string | null = null;

    for (let i = 0; i < response.functionCalls.length; i++) {
      const functionCall = response.functionCalls[i];

      const script = functions.find(
        (func) => func.name === functionCall.name
      )?.script;
      if (typeof script === "undefined")
        throw new Error(
          `Failed to find function with name: ${functionCall.name}`
        );

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

      // Add the result with call index
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
