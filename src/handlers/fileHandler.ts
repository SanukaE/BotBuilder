import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import getAllFiles from '#utils/getAllFiles.js';
import Gemini from '#libs/Gemini.js';
import registerCommands from '../events/ready/4registerCommands.js';
import { registerRoutes } from '../events/ready/3setupAPI.js';
import { Client } from 'discord.js';

export default function (client: Client) {
  return; //! W.I.P: Could cause crashes if allowed to run at it's current state

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionTypePaths = getAllFiles(
    path.join(__dirname, '..', '..', 'src', 'actions'),
    true
  );

  for (const actionTypePath of actionTypePaths) {
    fs.watch(actionTypePath, (eventType, fileName) => {
      if (!fileName) return;
      addListeners(actionTypePath, client);
    });

    addListeners(actionTypePath, client);
  }
}

function addListeners(actionTypePath: string, client: Client) {
  const actionCategoryPaths = getAllFiles(actionTypePath, true);

  for (const actionCategoryPath of actionCategoryPaths) {
    listenToFiles(actionCategoryPath, actionTypePath, client);

    const actionSubCategoryPaths = getAllFiles(actionCategoryPath, true);

    for (const actionSubCategoryPath of actionSubCategoryPaths) {
      listenToFiles(actionSubCategoryPath, actionTypePath, client);
    }
  }
}

function listenToFiles(
  actionCategoryPath: string,
  actionTypePath: string,
  client: Client
) {
  fs.watch(actionCategoryPath, async (eventType, fileName) => {
    switch (eventType) {
      case 'change':
        await handleFileChange(actionCategoryPath, fileName, actionTypePath);
        break;

      case 'rename':
        await handleFileRename(actionCategoryPath, fileName, actionTypePath);
        break;
    }

    switch (true) {
      case actionTypePath.endsWith('commands'):
        setTimeout(async () => {
          await registerCommands(client);
        }, 20_000);
        break;

      case actionTypePath.endsWith('routes'):
        setTimeout(async () => {
          await registerRoutes(client);
        }, 20_000);
        break;
    }
  });
}

//Called when file is modified
async function handleFileChange(
  fileDir: string,
  fileName: string | null,
  actionTypePath: string
) {
  if (!fileName) return;

  const filePath = path.join(fileDir, fileName);
  let actionData = fs.readFileSync(filePath, 'utf-8');

  const actionTypeName = actionTypePath.split('\\').pop()!;
  const templateCode = getTemplateCode(fileName, actionTypeName);

  if (
    actionData.includes(templateCode) ||
    actionData === '' ||
    !actionData.includes('AI Help:')
  )
    return;

  const { enabled, model, fileManager } = Gemini();
  if (!enabled) return;

  const problemRegex = /\/\*([\s\S]*?)\*\//g;

  let match;
  const aiProblems: { start: number; end: number; content: string }[] = [];

  while ((match = problemRegex.exec(actionData)) !== null) {
    const commentContent = match[1].trim();

    if (commentContent.startsWith('AI Help:')) {
      aiProblems.push({
        start: match.index,
        end: match.index + match[0].length,
        content: commentContent.replace(/^AI Help:\s*/, '').trim(),
      });
    }
  }

  for (const problem of aiProblems) {
    const actionFileUpload = await fileManager?.uploadFile(filePath, {
      mimeType: 'text/typescript',
      displayName: fileName.split('.')[0],
    })!;

    const result = await model?.generateContent([
      {
        fileData: {
          mimeType: 'text/typescript',
          fileUri: actionFileUpload.file.uri,
        },
      },
      {
        text: `Ignoring all the comments that start with "AI Help:" or "AI Solution:".\n${problem.content}`,
      },
    ]);

    const solutionComment = `/*AI Solution:\n${result?.response.text()}\n*/`;
    actionData =
      actionData.slice(0, problem.start) +
      solutionComment +
      actionData.slice(problem.end);
  }

  fs.writeFileSync(filePath, actionData, 'utf-8');
}

//Called when file is renamed, created or deleted
async function handleFileRename(
  fileDirPath: string,
  fileName: string | null,
  actionTypePath: string
) {
  if (!fileName) return;

  let filePath = path.join(fileDirPath, fileName);

  //On File delete
  if (!fs.existsSync(filePath)) return;

  const actionTypeName = actionTypePath.split('\\').pop()!;
  const fileStream = fs.createWriteStream(filePath, { flags: 'a' });
  const templateCode = getTemplateCode(fileName, actionTypeName);

  const actionData = fs.readFileSync(filePath, 'utf-8');

  //Checks if file was renamed
  if (actionData.includes(templateCode) || actionData.length > 0) return;

  fileStream.write(templateCode);
  fileStream.close();
}

function getTemplateCode(fileName: string, actionType: string) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToTemplate = path.join(
    __dirname,
    '..',
    '..',
    'public',
    'templateCode',
    `${actionType}.txt`
  );

  let templateCode = fs.readFileSync(pathToTemplate, 'utf-8');

  templateCode = templateCode
    .replaceAll('{{actionName}}', fileName.split('.')[0])
    .replaceAll('{{fileName}}', fileName);

  return templateCode;
}
