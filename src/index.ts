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
import { createWarning } from "#utils/createLogger.js";

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

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const envFilePath = path.join(__dirname, "../.env");
  const tempEnvFilePath = path.join(__dirname, "../.env.template");

  if (!fs.existsSync(envFilePath)) {
    console.log("[System] Running setup...");
    await setup();
  }

  async function startBot() {
    if (fs.existsSync(tempEnvFilePath)) {
      createWarning(
        "Possible outdated config/env variables found.",
        "Some features might not work or could break the bot.",
        "To update your server variables, delete the .env file and config folder from your server files. Before deleting these files, make a copy so you can save time resetting them. Then, restart your server.",
        "main-index"
      );
    }

    checkEnvVariables();

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
      console.log("[System] BotBuilder is shutting down...");

      await client.destroy();

      await MySQL.end();
      await Redis.disconnect();

      //closeWatchers(); //!WIP

      try {
        const tempFolder = path.join(process.cwd(), "temp");
        fs.rmSync(tempFolder, { recursive: true });
      } catch (error) {
        null;
      }

      console.log("[System] Have a nice day!");
      process.exit(0);
    };

    process.on("SIGTERM", handleShutdown);
  }

  await startBot();
}

main().catch((error) => {
  console.error("[Error] An error occurred while starting the bot:", error);
  process.exit(1);
});
