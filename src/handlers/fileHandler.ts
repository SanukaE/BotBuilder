import Gemini from "#libs/Gemini.js";
import getAllFiles from "#utils/getAllFiles.js";
import getConfig from "#utils/getConfig.js";
import { createPartFromUri, createUserContent } from "@google/genai";
import { Client } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const filesInProcess = new Set<string>();
const { geminiModel } = getConfig("ai") as { geminiModel: string };

export default function (client: Client) {
  return; //!WIP
  let actionFilePaths: string[] = [];

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionTypes = getAllFiles(
    path.join(__dirname, "../../src/actions"),
    true
  );

  for (const actionType of actionTypes) {
    const actionCategories = getAllFiles(actionType, true);

    for (const actionCategory of actionCategories) {
      actionFilePaths.push(...getAllFiles(actionCategory));

      getAllFiles(actionCategory, true).forEach((cat) => {
        actionFilePaths.push(...getAllFiles(cat));
      });
    }
  }

  let watchers: fs.FSWatcher[] = [];

  for (const filePath of actionFilePaths) {
    const watcher = fs.watch(filePath, async (eventType, filename) => {
      if (eventType === "change" && !filename?.includes("~"))
        await handleUpdate(filePath).catch((err) =>
          console.log(
            `[Error] Failed to check for update: ${err.message || err}`
          )
        );
    });

    watchers.push(watcher);
  }

  return () => watchers.forEach((watcher) => watcher.close());
}

async function handleUpdate(filePath: string) {
  if (filesInProcess.has(filePath)) return;

  if (!(fs.existsSync(filePath) && fs.statSync(filePath).isFile()))
    throw new Error(
      `The specified path "${filePath}" either does not exist or is not a valid file.`
    );

  if (path.extname(filePath).toLowerCase() !== ".ts") return;

  let fileContent = fs.readFileSync(filePath, "utf-8");
  if (fileContent === "") return;

  const matches = fileContent.matchAll(/\/\*\s*AI Help:\s*([\s\S]*?)\s*\*\//g);
  const prompts = Array.from(matches);

  if (prompts.length === 0) return;

  filesInProcess.add(filePath);

  const gemini = Gemini();

  if (!gemini.enabled) {
    fs.writeFileSync(
      filePath,
      fileContent.replaceAll(
        /\/\*\s*AI Help:\s*([\s\S]*?)\s*\*\//g,
        "//AI is disabled"
      )
    );
    filesInProcess.delete(filePath);
    return;
  }

  const extractedPrompts = prompts.map((match) => match[1].trim());

  const fileUploadResult = await gemini.fileManager!.upload({
    file: filePath,
    config: {
      mimeType: "text/typescript",
      displayName: "Source File",
    },
  });

  for (const helpPrompt of extractedPrompts) {
    fileContent = fileContent.replace(
      /\/\*\s*AI Help:\s*([\s\S]*?)\s*\*\//,
      "//Processing..."
    );

    fs.writeFileSync(filePath, fileContent);

    try {
      const result = await gemini.model!.generateContent({
        model: geminiModel || "gemini-2.5-flash",
        contents: createUserContent([
          createPartFromUri(fileUploadResult.uri!, fileUploadResult.mimeType!),
          helpPrompt,
          "Your response is used to replace the '//Processing...' comment with a multi line comment containing your response. So do not use markdown & try responding in text only. Ignore comments with prefix 'AI Help:', 'AI Solution:' or 'Processing...'.",
        ]),
        config: {
          tools: [{ urlContext: {} }, { googleSearch: {} }],
          maxOutputTokens: 500,
        },
      });

      const solution = result.text;

      if (solution === "") {
        fileContent = fileContent.replace(
          /\/\/Processing\.\.\./,
          "//A solution cannot be found"
        );

        fs.writeFileSync(filePath, fileContent);
        continue;
      }

      fileContent = fileContent.replace(
        /\/\/Processing\.\.\./,
        `/*AI Solution:\n${solution}*/`
      );

      fs.writeFileSync(filePath, fileContent);
    } catch (error: any) {
      console.log(`[Error] Failed to get AI help: ${error.message || error}`);

      fileContent = fileContent.replace(
        /\/\/Processing\.\.\./,
        "//Processing Failed! Please check console."
      );

      fs.writeFileSync(filePath, fileContent);
    } finally {
      filesInProcess.delete(filePath);
    }
  }
}
