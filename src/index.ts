import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import eventHandler from './handlers/eventHandler.js';
import fileHandler from './handlers/fileHandler.js';
import checkEnvVariables from '#utils/checkEnvVariables.js';
import Gemini from '#libs/Gemini.js';
import MySQL from '#libs/MySQL.js';
import Redis from '#libs/Redis.js';

console.log(`
$$$$$$$\\             $$\\     $$$$$$$\\            $$\\ $$\\       $$\\                     
$$  __$$\\            $$ |    $$  __$$\\           \\__|$$ |      $$ |                    
$$ |  $$ | $$$$$$\\ $$$$$$\\   $$ |  $$ |$$\\   $$\\ $$\\ $$ | $$$$$$$ | $$$$$$\\   $$$$$$\\  
$$$$$$$\\ |$$  __$$\\\\_$$  _|  $$$$$$$\\ |$$ |  $$ |$$ |$$ |$$  __$$ |$$  __$$\\ $$  __$$\\ 
$$  __$$\\ $$ /  $$ | $$ |    $$  __$$\\ $$ |  $$ |$$ |$$ |$$ /  $$ |$$$$$$$$ |$$ |  \\__|
$$ |  $$ |$$ |  $$ | $$ |$$\\ $$ |  $$ |$$ |  $$ |$$ |$$ |$$ |  $$ |$$   ____|$$ |      
$$$$$$$  |\\$$$$$$  | \\$$$$  |$$$$$$$  |\\$$$$$$  |$$ |$$ |\\$$$$$$$ |\\$$$$$$$\\ $$ |      
\\_______/  \\______/   \\____/ \\_______/  \\______/ \\__|\\__| \\_______| \\_______|\\__|      
                                                                                       
`);
console.log(
  'Your Free, Open-Source, All-In-One Discord Companion. A project by Sanuka.\n\n'
);

checkEnvVariables();

export const client = new Client({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.AutoModerationConfiguration,
  ],
});

eventHandler(client);
fileHandler(client);

client.login(process.env.APP_TOKEN);

const handleShutdown = async () => {
  console.log('\n\nBotBuilder is shutting down...');

  await client.destroy();

  await MySQL.end();
  await Redis.disconnect();

  const { fileManager } = Gemini();

  if (fileManager) {
    const uploadedFiles = (await fileManager.listFiles()).files;

    if (uploadedFiles?.length > 0) {
      for (const file of uploadedFiles) {
        await fileManager.deleteFile(file.name);
      }
    }
  }

  console.log('Have a nice day!');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
