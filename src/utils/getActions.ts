import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import getAllFiles from "./getAllFiles.js";
import checkEnvVariables from "./checkEnvVariables.js";
import getConfig from "./getConfig.js";
import CommandType from "#types/CommandType.js";
import ReactionType from "#types/ReactionType.js";
import ButtonType from "#types/ButtonType.js";
import ModalType from "#types/ModalType.js";
import StringMenuType from "#types/StringMenuType.js";

/**
 * Enum representing different types of actions available in the system.
 * @enum {string}
 * @property {string} Commands - Represents command actions
 * @property {string} Reactions - Represents reaction actions
 * @property {string} Buttons - Represents button actions
 * @property {string} Modals - Represents modal actions
 * @property {string} StringMenus - Represents string menu actions
 */
export enum ActionTypes {
  Commands = "commands",
  Reactions = "reactions",
  Buttons = "buttons",
  Modals = "modals",
  StringMenus = "stringMenus",
}

/**
 * Retrieves actions of a specified type from the file system.
 *
 * @param actionType - The type of actions to retrieve from the ActionTypes enum
 * @returns Promise resolving to an array of action objects matching the specified type
 *          (CommandType[], ReactionType[], RouteType[], ButtonType[], ModalType[], or StringMenuType[])
 *
 * @remarks
 * - Scans directories under 'actions/{actionType}' for action files
 * - Skips disabled categories specified in config
 * - Skips categories with missing required environment variables
 * - Automatically skips 'api' category if webserver port is disabled (-1)
 * - Recursively processes subcategories within each action category
 *
 * @example
 * ```typescript
 * const commands = await getActions(ActionTypes.Commands);
 * const reactions = await getActions(ActionTypes.Reactions);
 * ```
 */
export async function getActions(actionType: ActionTypes) {
  const { disabledCategories, webServerPort } = getConfig("application") as {
    disabledCategories: string[];
    webServerPort: number;
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionCategories = getAllFiles(
    path.join(__dirname, "..", "actions", actionType),
    true
  );
  const missingVariables = checkEnvVariables();
  let skipCategories: string[] =
    webServerPort === -1
      ? ["api", ...disabledCategories, ...missingVariables]
      : [...disabledCategories, ...missingVariables];

  const actions:
    | CommandType[]
    | ReactionType[]
    | ButtonType[]
    | ModalType[]
    | StringMenuType[] = [];

  for (const actionCategory of actionCategories) {
    if (skipCategories.includes(actionCategory.split("/").pop()!)) continue;

    const pushActions = async (categoryPath: string) => {
      const actionFiles = getAllFiles(categoryPath);

      for (const actionFile of actionFiles) {
        const fileUrl = pathToFileURL(actionFile).href;
        const actionModule = await import(fileUrl);
        const action = actionModule.default;

        actions.push(action);
      }
    };

    await pushActions(actionCategory);

    const actionSubCategories = getAllFiles(actionCategory, true);

    for (const actionSubCategory of actionSubCategories) {
      await pushActions(actionSubCategory);
    }
  }

  return actions;
}
