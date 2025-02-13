import { Client } from 'discord.js';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import getAllFiles from '#utils/getAllFiles.js';

/**
 * Initializes and sets up event handlers for a Discord client.
 * This function dynamically imports and registers event handlers from the events directory.
 * 
 * @param client - The Discord.js Client instance to register events for
 * 
 * @remarks
 * The function performs the following steps:
 * 1. Resolves the current file path and directory
 * 2. Gets all event folders from the events directory
 * 3. For each event folder:
 *    - Extracts the event name from the folder path
 *    - Gets all event handler files within that folder
 *    - Sets up an event listener that will execute all handlers for that event
 * 
 * Each event handler file is dynamically imported and executed when the corresponding event occurs.
 * Event handlers are executed sequentially in the order they are found.
 * 
 * @example
 * ```ts
 * import { Client } from 'discord.js';
 * const client = new Client();
 * eventHandler(client);
 * ```
 */
export default function (client: Client) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const eventFolders = getAllFiles(path.join(__dirname, '..', 'events'), true);

  eventFolders.forEach((eventFolder) => {
    const eventName = eventFolder.replace(/\\/g, '/').split('/').pop()!;
    const eventFiles = getAllFiles(eventFolder);

    client.on(eventName, async (...args) => {
      for (const eventFile of eventFiles) {
        const fileUrl = pathToFileURL(eventFile).href;
        const eventFunction = await import(fileUrl);
        await eventFunction.default(client, ...args);
      }
    });
  });
}
