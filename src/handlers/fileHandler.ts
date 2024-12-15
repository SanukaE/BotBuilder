import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import getAllFiles from '../utils/getAllFiles.js';
import initializeAI from '../utils/initializeAI.js';
import registerCommands from '../events/ready/registerCommands.js';
import { Client } from 'discord.js';

export default function (client: Client) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionTypePaths = getAllFiles(
    path.join(__dirname, '..', '..', '..', 'src', 'actions'),
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
    const actionFilePaths = getAllFiles(actionCategoryPath);

    const actionFiles = actionFilePaths.map(
      (filePath) => filePath.split('/').pop()!
    );

    fs.watch(actionCategoryPath, async (eventType, fileName) => {
      switch (eventType) {
        case 'change':
          await handleFileChange(actionCategoryPath, fileName!, actionTypePath);
          break;

        case 'rename':
          await handleFileRename(
            actionCategoryPath,
            fileName!,
            actionFiles,
            actionTypePath
          );
          break;
      }

      if (actionTypePath.endsWith('commands')) {
        setTimeout(async () => {
          await registerCommands(client);
        }, 20_000);
      }
    });
  }
}

//Called when file is modified
async function handleFileChange(
  fileDir: string,
  fileName: string,
  actionTypePath: string
) {
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

  const { enabled, model, fileManager } = initializeAI();
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
    //TODO: Send problem to AI
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
        text: `Ignoring all the comments that start with "AI Help:" or "AI Solution:". Give me a solution without using markdown & when ur showing code blocks don't use \`\`\`language code\`\`\` just display the code itself. \nThis is the problem:\n${problem.content}`,
      },
    ]);

    const solutionComment = `/* AI Solution:\n${result?.response.text()}\n*/`;
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
  fileName: string,
  existingFiles: string[],
  actionTypePath: string
) {
  let filePath = path.join(fileDirPath, fileName);

  //On File delete
  if (!fs.existsSync(filePath)) return;

  //Rest of the code is for file creation
  if (existingFiles.includes(fileName)) return;

  const actionTypeName = actionTypePath.split('\\').pop()!;
  const fileStream = fs.createWriteStream(filePath, { flags: 'a' });
  const templateCode = getTemplateCode(fileName, actionTypeName);

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
    '..',
    'src',
    'assets',
    'templateCode',
    `${actionType}.txt`
  );

  let templateCode = fs.readFileSync(pathToTemplate, 'utf-8');

  templateCode = templateCode
    .replace('{{actionName}}', fileName.split('.')[0])
    .replace('{{fileName}}', fileName);

  return templateCode;
}
