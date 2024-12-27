import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ActionTypes } from './getActions.js';
import getAllFiles from './getAllFiles.js';

export default async function (actionName: string, actionType: ActionTypes) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionFolders = getAllFiles(
    path.join(__dirname, '..', '..', 'src', 'actions'),
    true
  );
  const actionFolder = actionFolders.find((actionFolder) =>
    actionFolder.endsWith(actionType)
  )!;

  const actionCategories = getAllFiles(actionFolder, true);

  const checkFiles = async (actionFiles: string[]) => {
    for (const actionFile of actionFiles) {
      const fileURL = pathToFileURL(actionFile).href;
      const fileExport = await import(fileURL);

      const { name, endpoint, customID } = fileExport.default;

      switch (actionName) {
        case name:
          return actionFile;

        case endpoint:
          return actionFile;

        case customID:
          return actionFile;
      }
    }
  };

  for (const actionCategory of actionCategories) {
    const actionFiles = getAllFiles(actionCategory);
    const actionSubCategories = getAllFiles(actionCategory, true);

    const result = await checkFiles(actionFiles);

    if (result) return result;

    for (const subCategory of actionSubCategories) {
      const categoryFiles = getAllFiles(subCategory);

      const result = await checkFiles(categoryFiles);

      if (result) return result;
    }
  }
}
