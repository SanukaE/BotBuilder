import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import getAllFiles from './getAllFiles.js';
import CommandType from './CommandType.js';
import ReactionType from './ReactionType.js';

export enum ActionTypes {
  Commands = 'commands',
  Reactions = 'reactions',
}

export async function getActions(
  actionType: ActionTypes,
  exceptions?: string[]
) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const actionCategories = getAllFiles(
    path.join(__dirname, '..', 'actions', actionType),
    true
  );

  const actions: CommandType[] | ReactionType[] = [];

  for (const actionCategory of actionCategories) {
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
