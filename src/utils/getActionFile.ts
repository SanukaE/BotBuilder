import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActionTypes } from './getActions.js';
import getAllFiles from './getAllFiles.js';

export default function (actionName: string, actionType: ActionTypes) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionFolders = getAllFiles(
    path.join(__dirname, '..', 'actions'),
    true
  );
  const actionFolder = actionFolders.find((actionFolder) =>
    actionFolder.endsWith(actionType)
  )!;

  const actionCategories = getAllFiles(actionFolder, true);

  for (const actionCategory of actionCategories) {
    const actionFiles = getAllFiles(actionCategory);

    for (const actionFile of actionFiles) {
      if (actionFile.endsWith(actionName + '.js')) return actionFile;
    }
  }
}
