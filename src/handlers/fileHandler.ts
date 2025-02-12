import Gemini from '#libs/Gemini.js';
import getAllFiles from '#utils/getAllFiles.js';
import { Client } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export default function (client: Client) {
  let actionFilePaths: string[] = [];

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionTypes = getAllFiles(
    path.join(__dirname, '../../src/actions'),
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
      if (eventType === 'change' && !filename?.includes('~'))
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

  if (path.extname(filePath).toLowerCase() !== '.ts') return;

  let fileContent = fs.readFileSync(filePath, 'utf-8');
  if (fileContent === '') return;

  const commentRegex = /\/\*\s*AI Help:\s*([\s\S]*?)\s*\*\//g;
  const matches = fileContent.matchAll(commentRegex);
  const prompts = Array.from(matches);

  if (prompts.length === 0) return;

  const gemini = Gemini();

  if (!gemini.enabled) {
    fs.writeFileSync(
      filePath,
      fileContent.replaceAll(commentRegex, '//AI is disabled')
    );
    return;
  }

  const extractedPrompts = prompts.map((match) => match[1].trim());

  const fileUploadResult = await gemini.fileManager!.uploadFile(filePath, {
    mimeType: 'text/typescript',
    displayName: 'Source File',
  });

  for (const helpPrompt of extractedPrompts) {
    fileContent = fileContent.replace(commentRegex, '//Processing...');

    fs.writeFileSync(filePath, fileContent);

    try {
      const result = await gemini.model!.generateContent([
        {
          fileData: {
            fileUri: fileUploadResult.file.uri,
            mimeType: fileUploadResult.file.mimeType,
          },
        },
        helpPrompt,
      ]);

      const solution = result.response.text();

      if (solution === '') {
        fileContent = fileContent.replace(
          /\/\/Processing\.\.\./g,
          '//A solution cannot be found'
        );

        fs.writeFileSync(filePath, fileContent);
        continue;
      }

      fileContent = fileContent.replace(
        /\/\/Processing\.\.\./g,
        `/*AI Solution:\n${solution}*/`
      );

      fs.writeFileSync(filePath, fileContent);
    } catch (error: any) {
      console.log(`[Error] Failed to get AI help: ${error.message || error}`);

      fileContent = fileContent.replace(
        /\/\/Processing\.\.\./g,
        '//Processing Failed! Please check console.'
      );

      fs.writeFileSync(filePath, fileContent);
    }
  }
}
