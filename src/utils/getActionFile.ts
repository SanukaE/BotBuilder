import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ActionTypes } from './getActions.js';
import getAllFiles from './getAllFiles.js';

/**
 * Finds and returns the file path of an action based on its name and type.
 * Searches through action folders and their subcategories recursively.
 * 
 * @param actionName - The name, endpoint, or customID of the action to find
 * @param actionType - The type of action to search for (from ActionTypes enum)
 * @returns Promise that resolves to the file path of the action if found, undefined otherwise
 * 
 * @example
 * ```typescript
 * const filePath = await getActionFile('myAction', ActionTypes.COMMAND);
 * ```
 * 
 * @remarks
 * The function searches through the following properties of action files:
 * - name
 * - endpoint 
 * - customID
 * 
 * The search is performed recursively through:
 * 1. Root action files in a category
 * 2. Files in subcategories
 */
export default async function (actionName: string, actionType: ActionTypes) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionFolders = getAllFiles(
    path.join(__dirname, '..', '..', 'actions'),
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
