import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import eventHandler from './handlers/eventHandler.js';
import fileHandler from './handlers/fileHandler.js';
import checkEnvVariables from '#utils/checkEnvVariables.js';
import initializeAI from '#utils/initializeAI.js';
import dbPool from '#utils/dbPool.js';

checkEnvVariables();

const client = new Client({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

eventHandler(client);
fileHandler(client);

client.login(process.env.APP_TOKEN);

const handleShutdown = async () => {
  console.log('⚡ BotBuilder shutting down...');

  await client.destroy();
  await dbPool.end();

  const { fileManager } = initializeAI();

  if (fileManager) {
    const uploadedFiles = (await fileManager.listFiles()).files;

    if (uploadedFiles?.length > 0) {
      for (const file of uploadedFiles) {
        await fileManager.deleteFile(file.name);
      }
    }
  }

  console.log('Have a nice day! 👋');
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
