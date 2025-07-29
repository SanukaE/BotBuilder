import { Client, GatewayIntentBits } from "discord.js";
import "dotenv/config";
import eventHandler from "./handlers/eventHandler.js";
import fileHandler from "./handlers/fileHandler.js";
import checkEnvVariables from "#utils/checkEnvVariables.js";
import path from "path";
import fs from "fs";
import MySQL from "#libs/MySQL.js";
import Redis from "#libs/Redis.js";
import { fileURLToPath } from "url";
import setup from "#utils/setup.js";
import getAllFiles from "#utils/getAllFiles.js";
import { registerFont } from "canvas";
import canvacord from "canvacord";

function logWelcomeMsg() {
  console.clear();

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
    "Your Free, Open-Source, All-In-One Discord Companion. A project by Sanuka.\n\n"
  );
}

logWelcomeMsg();

console.log("[System] Check for environment file...");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFilePath = path.join(__dirname, "../.env");

if (!fs.existsSync(envFilePath)) {
  console.log("[System] .env file not found! Running setup...");
  await setup();
  logWelcomeMsg();
} else console.log("[System] .env file found!");

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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildScheduledEvents,
  ],
});

eventHandler(client);
const closeWatchers = fileHandler(client);

console.log("[System] Registering fonts...");
const fontDir = path.join(__dirname, "../public/fonts");
const fontFiles = getAllFiles(fontDir).filter(
  (file) => file.endsWith(".ttf") || file.endsWith(".otf")
);

for (const fontFile of fontFiles) {
  const [fontFamily, fontWeight] = path
    .basename(fontFile, path.extname(fontFile))
    .split("-");

  registerFont(fontFile, { family: fontFamily, weight: fontWeight });
}
canvacord.Font.loadDefault();
console.log("[System] Fonts registered successfully!");

client.login(process.env.APP_TOKEN);

const handleShutdown = async () => {
  console.log("\n\nBotBuilder is shutting down...");

  await client.destroy();

  await MySQL.end();
  await Redis.disconnect();

  closeWatchers();

  try {
    const tempFolder = path.join(process.cwd(), "temp");
    fs.rmSync(tempFolder, { recursive: true });
  } catch (error) {
    null;
  }

  console.log("Have a nice day!");
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);
