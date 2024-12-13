import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import eventHandler from './handlers/eventHandler.js';
import checkEnvVariables from './utils/checkEnvVariables.js';
import initializeAI from './utils/initializeAI.js';

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

client.login(process.env.APP_TOKEN);

const handleShutdown = async () => {
  console.log('Shutting down...');
  client.destroy();

  const { fileManager } = initializeAI();

  if (fileManager) {
    const uploadedFiles = await fileManager.listFiles();

    for (const file of uploadedFiles.files) {
      await fileManager.deleteFile(file.name);
    }
  }

  console.log('Have a good day! 👋');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
