import getAllFiles from './getAllFiles.js';
import path from 'path';
import { fileURLToPath } from 'url';
import getActionFile from './getActionFile.js';
import Gemini from '#libs/Gemini.js';
import fs from 'fs';
import { ActionTypes } from './getActions.js';
import CommandType from '#types/CommandType.js';
import ReactionType from '#types/ReactionType.js';
import { RouteType } from '#types/RouteType.js';
import ButtonType from '#types/ButtonType.js';
import ModalType from '#types/ModalType.js';
import StringMenuType from '#types/StringMenuType.js';

export default async function (
  action:
    | CommandType
    | ReactionType
    | RouteType
    | ButtonType
    | ModalType
    | StringMenuType,
  actionType: ActionTypes
) {
  const { enabled, model, fileManager } = Gemini();

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

  let actionName = 'N/A';

  switch (actionType) {
    case ActionTypes.Commands:
    case ActionTypes.Reactions:
      actionName = (action as CommandType | ReactionType).name;
      break;

    case ActionTypes.Routes:
      actionName = (action as RouteType).endpoint.replaceAll('/', '_');
      break;

    case ActionTypes.Buttons:
    case ActionTypes.Modals:
      actionName = (action as ButtonType | ModalType).customID;
      break;
  }

  const errorFile = errorFiles.find((errorFile) =>
    errorFile.endsWith(
      `${actionName}-${actionType.slice(0, actionType.length - 1)}.txt`
    )
  )!;
  const debugFile = debugFiles.find((debugFile) =>
    debugFile.endsWith(
      `${actionName}-${actionType.slice(0, actionType.length - 1)}.txt`
    )
  )!;
  const actionFile = await getActionFile(actionName, actionType)!;

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
