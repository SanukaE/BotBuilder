import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import getAllFiles from './getAllFiles.js';
import CommandType from './CommandType.js';

export default async function getLocalCommands(exceptions?: string[]) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const commandCategories = getAllFiles(
    path.join(__dirname, '..', 'commands'),
    true
  );

  const localCommands: CommandType[] = [];

  for (const commandCategory of commandCategories) {
    const commandFiles = getAllFiles(commandCategory);

    for (const commandFile of commandFiles) {
      const fileUrl = pathToFileURL(commandFile).href;
      const commandModule = await import(fileUrl);
      const command = commandModule.default;

      if (exceptions?.includes(command.name)) continue;

      localCommands.push(command);
    }
  }

  return localCommands;
}
