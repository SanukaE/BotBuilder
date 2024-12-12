import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import eventHandler from './handlers/eventHandler.js';
import checkEnvVariables from './utils/checkEnvVariables.js';

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
//TODO: Delete the log file from file manager

client.login(process.env.APP_TOKEN);
