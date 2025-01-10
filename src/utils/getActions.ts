import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import getAllFiles from './getAllFiles.js';
import checkEnvVariables from './checkEnvVariables.js';
import config from '#config' assert { type: 'json' };
import CommandType from '#types/CommandType.js';
import ReactionType from '#types/ReactionType.js';
import { RouteType } from '#types/RouteType.js';
import ButtonType from '#types/ButtonType.js';
import ModalType from '#types/ModalType.js';
import StringMenuType from '#types/StringMenuType.js';

export enum ActionTypes {
  Commands = 'commands',
  Reactions = 'reactions',
  Routes = 'routes',
  Buttons = 'buttons',
  Modals = 'modals',
  StringMenus = 'stringMenus',
}

export async function getActions(actionType: ActionTypes) {
  const { disabledCategories } = config;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionCategories = getAllFiles(
    path.join(__dirname, '..', 'actions', actionType),
    true
  );
  const missingVariables = checkEnvVariables();
  let skipCategories: string[] = [];

  const actions:
    | CommandType[]
    | ReactionType[]
    | RouteType[]
    | ButtonType[]
    | ModalType[]
    | StringMenuType[] = [];

  for (const actionCategory of actionCategories) {
    missingVariables.forEach((variable) => {
      if (actionCategory.endsWith(variable))
        skipCategories.push(actionCategory);
    });

    disabledCategories.forEach((category) => {
      if (
        actionCategory.endsWith(category) &&
        !skipCategories.includes(category)
      )
        skipCategories.push(actionCategory);
    });

    if (skipCategories.includes(actionCategory)) continue;

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
