import { Client } from 'discord.js';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import getAllFiles from '../utils/getAllFiles.js';

export default function (client: Client) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const eventFolders = getAllFiles(path.join(__dirname, '..', 'events'), true);

  eventFolders.forEach((eventFolder) => {
    const eventName = eventFolder.replace(/\\/g, '/').split('/').pop()!;
    const eventFiles = getAllFiles(eventFolder);

    client.on(eventName, (...args) => {
      eventFiles.forEach(async (eventFile) => {
        const fileUrl = pathToFileURL(eventFile).href;
        const eventFunction = await import(fileUrl);
        await eventFunction.default(client, ...args);
      });
    });
  });
}
