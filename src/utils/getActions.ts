import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import getAllFiles from './getAllFiles.js';
import CommandType from './CommandType.js';
import ReactionType from './ReactionType.js';
import checkEnvVariables from './checkEnvVariables.js';
import config from '../../config.json' assert { type: 'json' };
import { RouteType } from './RouteType.js';

export enum ActionTypes {
  Commands = 'commands',
  Reactions = 'reactions',
  Routes = 'routes',
}

export async function getActions(
  actionType: ActionTypes,
  exceptions?: string[]
) {
  const { disabledCategories } = config;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionCategories = getAllFiles(
    path.join(__dirname, '..', 'actions', actionType),
    true
  );
  const missingVariables = checkEnvVariables();
  let skipCategories: string[] = [];

  const actions: CommandType[] | ReactionType[] | RouteType[] = [];

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

    const actionFiles = getAllFiles(actionCategory);

    for (const actionFile of actionFiles) {
      const fileUrl = pathToFileURL(actionFile).href;
      const actionModule = await import(fileUrl);
      const action = actionModule.default;

      if (exceptions?.includes(action.name)) continue;

      actions.push(action);
    }
  }

  return actions;
}
