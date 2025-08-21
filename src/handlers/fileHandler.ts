import Gemini from "#libs/Gemini.js";
import getAllFiles from "#utils/getAllFiles.js";
import getConfig from "#utils/getConfig.js";
import { createPartFromUri, createUserContent } from "@google/genai";
import { Client } from "discord.js";
import fs from "fs";
import path from "path";

const { geminiModel } = getConfig("ai") as { geminiModel: string };

export default function (client: Client) {
  let actionFilePaths: string[] = [];

  const actionTypes = getAllFiles(
    path.join(process.cwd(), "/src/actions"),
    true
  );

  function collectFilesRecursively(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFilesRecursively(fullPath);
      } else {
        actionFilePaths.push(fullPath);
      }
    }
  }

  for (const actionType of actionTypes) {
    collectFilesRecursively(actionType);
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
  if (!(fs.existsSync(filePath) && fs.statSync(filePath).isFile()))
    throw new Error(
      `The specified path "${filePath}" either does not exist or is not a valid file.`
    );

  if (path.extname(filePath).toLowerCase() !== ".ts") return;

  let fileContent = fs.readFileSync(filePath, "utf-8");
  if (fileContent === "") return;

  const prompt = fileContent.match(/\/\*\s*AI Help:\s*([\s\S]*?)\s*\*\//g);
  if (!prompt) return;

  const gemini = Gemini();

  if (!gemini.enabled) {
    fs.writeFileSync(
      filePath,
      fileContent.replaceAll(
        /\/\*\s*AI Help:\s*([\s\S]*?)\s*\*\//g,
        "//AI is disabled"
      )
    );
    return;
  }

  const extractedPrompts = prompt.map((p) => p.trim());

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
          "Your response is used to replace the '//Processing...' comment with a multi line comment containing your response. So do not use markdown & try responding in text only.",
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
    }
  }
}
