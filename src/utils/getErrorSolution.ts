import getAllFiles from './getAllFiles.js';
import path from 'path';
import { fileURLToPath } from 'url';
import getActionFile from './getActionFile.js';
import initializeAI from './initializeAI.js';
import fs from 'fs';
import CommandType from './CommandType.js';
import ReactionType from './ReactionType.js';
import { ActionTypes } from './getActions.js';

export default async function (action: CommandType | ReactionType) {
  const { enabled, model, fileManager } = initializeAI();

  if (!enabled && (!model || !fileManager)) return;
  if (!action.isDevOnly || !action.enableDebug) return;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const errorFiles = getAllFiles(
    path.join(__dirname, '..', '..', 'actionLogs', 'errors')
  );
  const debugFiles = getAllFiles(
    path.join(__dirname, '..', '..', 'actionLogs', 'debugs')
  );

  const errorFile = errorFiles.find((errorFile) =>
    errorFile.endsWith(`${action.name}-command.txt`)
  )!;
  const debugFile = debugFiles.find((debugFile) =>
    debugFile.endsWith(`${action.name}-command.txt`)
  )!;
  const actionFile = getActionFile(action.name, ActionTypes.Commands)!;

  if (!errorFile || !debugFile || !actionFile) return 'No possible fix found.';

  const result = await model?.generateContent([
    'Summaries a fix for the error (in less than 2000 charters):',
    fileToGenerativePart(errorFile, 'text/plain'),
    fileToGenerativePart(debugFile, 'text/plain'),
    fileToGenerativePart(actionFile, 'text/javascript'),
  ]);

  const solution = result?.response.text();

  return solution;
}

function fileToGenerativePart(path: string, mimeType: string) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString('base64'),
      mimeType,
    },
  };
}
