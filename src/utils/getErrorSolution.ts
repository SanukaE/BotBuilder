import getAllFiles from './getAllFiles.js';
import path from 'path';
import { fileURLToPath } from 'url';
import getActionFile from './getActionFile.js';
import initializeAI from './initializeAI.js';
import fs from 'fs';
import CommandType from '#types/CommandType.js';
import ReactionType from '#types/ReactionType.js';
import { ActionTypes } from './getActions.js';
import { RouteType } from '#types/RouteType.js';

export default async function (
  action: CommandType | ReactionType | RouteType,
  actionType: ActionTypes
) {
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
    errorFile.endsWith(
      `${action.name}-${actionType.slice(0, actionType.length - 1)}.txt`
    )
  )!;
  const debugFile = debugFiles.find((debugFile) =>
    debugFile.endsWith(
      `${action.name}-${actionType.slice(0, actionType.length - 1)}.txt`
    )
  )!;
  const actionFile = await getActionFile(action.name, actionType)!;

  if (!errorFile || !debugFile || !actionFile) return 'No possible fix found.';

  const result = await model?.generateContent([
    'Summaries a fix for the error in less than 2000 charters:',
    fileToGenerativePart(errorFile, 'text/plain'),
    fileToGenerativePart(debugFile, 'text/plain'),
    fileToGenerativePart(actionFile, 'text/typescript'),
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
