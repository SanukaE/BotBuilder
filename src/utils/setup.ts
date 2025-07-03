import readline from "readline";
import { Client } from "discord.js";
import mysql from "mysql2";
import { createClient } from "redis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

let userName: string | undefined;

let environment: {
  APP_TOKEN?: string;
  APP_SECRET?: string;
  WEB_SERVER_IP?: string;
  WEB_SERVER_PORT?: string;
  MYSQL_HOST?: string;
  MYSQL_PORT?: string;
  MYSQL_USER?: string;
  MYSQL_PASSWORD?: string;
  MYSQL_DATABASE?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  GEMINI_API_KEY?: string;
  NAMELESSMC_API_URL?: string;
  NAMELESSMC_API_KEY?: string;
  MCSTATISTICS_SECRET?: string;
} = {};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default async function setup() {
  console.clear();
  console.log("========================================");
  console.log("BotBuilder Setup");
  console.log("========================================");

  console.log("Welcome to BotBuilder setup!");
  console.log("I will be helping you through the setup process.");
  console.log(
    "It will only take around 5-15mins of your time and it's a one-time process."
  );
  console.log(
    "If you need a break, you can always come back and continue later as long as you don't shut me down or restart."
  );
  console.log("Let's get started! But first can I know your name?\n");

  userName = await askForInput("How should I call you?: ");

  while (!userName) {
    console.log("Please provide a valid name.");
    userName = await askForInput("How should I call you?: ");
  }

  console.log(`\nNice to meet you, ${userName}!`);

  console.log("Let's begin with the setup process.\n");

  console.log("First, we need to set up your Discord bot token.");
  console.log(
    "This token is used to authenticate your bot with Discord's API."
  );

  console.log(
    "Head over to https://discord.com/developers/applications and create a new application."
  );
  console.log(
    "Once you have created the application head to your application's bot tab."
  );
  console.log(
    "Scroll down to the 'Token' section and click on 'Reset Token' to regenerate a new token."
  );
  console.log("Then copy the token and paste it below.\n");

  environment.APP_TOKEN = await askForInput("Enter your Discord bot token: ");

  while (!(await verifyToken())) {
    console.log("Invalid token. Please try again.");
    environment.APP_TOKEN = await askForInput("Enter your Discord bot token: ");
  }

  console.log("Perfect! Now for your application secret.");
  console.log('This can be found in the "OAuth2" tab of your application.\n');

  environment.APP_SECRET = await askForInput("Enter your application secret: ");

  while (!environment.APP_SECRET) {
    console.log("Please provide a valid application secret.");
    environment.APP_SECRET = await askForInput(
      "Enter your application secret: "
    );
  }

  console.log(
    `Awesome ${userName}! Now that we have your Discord bot token and application secret, let's set up your web server.\n`
  );

  environment.WEB_SERVER_IP = await askForInput("Enter your web server IP: ");
  environment.WEB_SERVER_PORT = await askForInput(
    "Enter your web server port: "
  );

  while (!(await verifyWebServer())) {
    console.log(
      "Failed to connect to the web server. Please check your connection details and try again."
    );
    environment.WEB_SERVER_IP = await askForInput("Enter your web server IP: ");
    environment.WEB_SERVER_PORT = await askForInput(
      "Enter your web server port: "
    );
  }

  console.log(
    `Great! Now that we have your web server set up, let's move on to the database and cache setup.`
  );
  console.log(
    "For the database, we will be using MySQL. If you don't have it installed, please install it first. "
  );
  console.log(
    "You can download it from https://dev.mysql.com/downloads/mysql/ or use a package manager like Homebrew or apt. Or use the builtin one with your server host."
  );
  console.log(
    "For the cache, we will be using Redis. If you don't have it installed, please install it first."
  );
  console.log(
    "You can download it from https://redis.io/download or use a package manager like Homebrew or apt. Or alternately you can use RedisCloud https://redis.io/cloud/ for free."
  );
  console.log(
    "Once you have installed/created MySQL and Redis, please provide the following details."
  );
  console.log(
    "For MySQL & Redis, you will need to provide the host, port, username, and password."
  );
  console.log("Please provide the details below.\n");

  environment.MYSQL_HOST = await askForInput("Enter your MySQL host: ");
  environment.MYSQL_PORT = await askForInput("Enter your MySQL port: ");
  environment.MYSQL_USER = await askForInput("Enter your MySQL username: ");
  environment.MYSQL_PASSWORD = await askForInput("Enter your MySQL password: ");
  environment.MYSQL_DATABASE = await askForInput(
    "Enter your MySQL database name: "
  );

  while (!(await verifyDatabaseConnection())) {
    console.log(
      "Failed to connect to the MySQL database. Please check your connection details and try again."
    );
    environment.MYSQL_HOST = await askForInput("Enter your MySQL host: ");
    environment.MYSQL_PORT = await askForInput("Enter your MySQL port: ");
    environment.MYSQL_USER = await askForInput("Enter your MySQL username: ");
    environment.MYSQL_PASSWORD = await askForInput(
      "Enter your MySQL password: "
    );
    environment.MYSQL_DATABASE = await askForInput(
      "Enter your MySQL database name: "
    );
  }

  environment.REDIS_HOST = await askForInput("Enter your Redis host: ");
  environment.REDIS_PORT = await askForInput("Enter your Redis port: ");
  environment.REDIS_USERNAME = await askForInput("Enter your Redis username: ");
  environment.REDIS_PASSWORD = await askForInput("Enter your Redis password: ");

  while (!(await verifyRedisConnection())) {
    console.log(
      "Failed to connect to the Redis server. Please check your connection details and try again."
    );
    environment.REDIS_HOST = await askForInput("Enter your Redis host: ");
    environment.REDIS_PORT = await askForInput("Enter your Redis port: ");
    environment.REDIS_USERNAME = await askForInput(
      "Enter your Redis username: "
    );
    environment.REDIS_PASSWORD = await askForInput(
      "Enter your Redis password: "
    );
  }

  console.log(
    `Your doing great ${userName}! Now that we have your database and cache set up, let's move on to the next few stuff.`
  );
  console.log(
    "These are optional but recommended for better performance and functionality.\n"
  );

  console.log(
    "We will be using Gemini API for AI functionalities. If you don't have an API key, please create one at https://aistudio.google.com/apikey.\n"
  );

  environment.GEMINI_API_KEY = await askForInput(
    "Enter your Gemini API key (-1 to skip): "
  );

  while (!(await verifyGeminiAPIKey())) {
    console.log(
      "Failed to connect to the Gemini API. Please check your API key and try again."
    );
    environment.GEMINI_API_KEY = await askForInput(
      "Enter your Gemini API key (-1 to skip): "
    );
  }
  if (environment.GEMINI_API_KEY === "-1")
    console.log(
      "No worries! We will skip the Gemini API setup for now. You can always set it up later in the .env file."
    );

  console.log(
    "Next, we will be setting up NamelessMC for website (powered by NamelessMC) management. If you don't have it installed, please install & set it up first."
  );
  console.log(
    "You can download it from https://namelessmc.com/ and follow the installation instructions."
  );
  console.log(
    "Once you have installed NamelessMC, please provide the following details."
  );
  console.log(
    "You will need to provide the NamelessMC API URL and API key. You can find these in your website's admin panel under 'API'.\n"
  );

  environment.NAMELESSMC_API_URL = await askForInput(
    "Enter your NamelessMC API URL (-1 to skip): "
  );
  environment.NAMELESSMC_API_KEY = await askForInput(
    "Enter your NamelessMC API key (-1 to skip): "
  );

  while (!(await verifyNamelessAPI())) {
    console.log(
      "Failed to connect to the NamelessMC API. Please check your connection details and try again."
    );
    environment.NAMELESSMC_API_URL = await askForInput(
      "Enter your NamelessMC API URL (-1 to skip): "
    );
    environment.NAMELESSMC_API_KEY = await askForInput(
      "Enter your NamelessMC API key (-1 to skip): "
    );
  }

  if (
    environment.NAMELESSMC_API_URL === "-1" ||
    environment.NAMELESSMC_API_KEY === "-1"
  )
    console.log(
      "No worries! We will skip the NamelessMC setup for now. You can always set it up later in the .env file."
    );

  console.log(
    "Finally, we will be setting up MCStatistics for your Minecraft server statistics. If you don't have it installed, please install it first."
  );
  console.log(
    "You can create an account/server at https://mcstatistics.org/ and get your secret from there.\n"
  );

  environment.MCSTATISTICS_SECRET = await askForInput(
    "Enter your MCStatistics secret (-1 to skip): "
  );

  while (!(await verifyMCStatisticsSecret())) {
    console.log(
      "Failed to connect to the MCStatistics API. Please check your connection details and try again."
    );
    environment.MCSTATISTICS_SECRET = await askForInput(
      "Enter your MCStatistics secret (-1 to skip): "
    );
  }

  if (environment.MCSTATISTICS_SECRET === "-1")
    console.log(
      "No worries! We will skip the MCStatistics setup for now. You can always set it up later in the .env file."
    );

  console.log(
    "\n\nSetup complete! Now that we have everything we need, let's save it to a file."
  );

  saveEnvironmentToFile();

  console.log("You can always change these settings later in the .env file.");
  console.log("Now you are all set to run BotBuilder!\n");

  console.log(
    "If you have any questions or need help, feel free to ask in the Discord server: https://discord.gg/7Z2a3b4X5C"
  );
  console.log(
    "If you want to make a donation to support the development of BotBuilder, you can do so at https://buy.stripe.com/aEU1567wDeEE5XyaEI"
  );
  console.log(
    "Thank you for using BotBuilder! I hope you have a great time using it.\n\n"
  );

  console.log("Proceeding to startup...");
  console.log(`Have a great day ${userName}! :)`);

  rl.close();
  await new Promise((resolve) => setTimeout(resolve, 20_000)); //20sec delay
}

function askForInput(question: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer ? answer.trim() : undefined);
    });
  });
}

async function verifyToken() {
  if (!environment.APP_TOKEN) {
    console.error(
      "No token provided. Please provide a valid Discord bot token."
    );
    return false;
  }

  return new Promise((resolve) => {
    const client = new Client({ intents: [] });

    client.once("ready", () => {
      console.log("Discord bot token verified successfully!\n");
      client.destroy();
      resolve(true);
    });

    client.once("error", (error) => {
      console.error("Failed to verify Discord bot token:", error.message);
      resolve(false);
    });

    client.login(environment.APP_TOKEN).catch((error) => {
      console.error("Failed to login with the provided token:", error.message);
      resolve(false);
    });
  });
}

async function verifyWebServer() {
  if (!environment.WEB_SERVER_IP || !environment.WEB_SERVER_PORT) {
    console.error(
      "Web server IP or port not provided. Please provide valid web server details."
    );
    return false;
  }

  const app = express();

  return new Promise((resolve) => {
    app.get("/", (req, res) => {
      res.send("Web server is successfully running!");
    });

    app.listen(parseInt(environment.WEB_SERVER_PORT!), () => {
      console.log(`Web server details verified successfully!\n`);
      resolve(true);
    });
  });
}

async function verifyDatabaseConnection() {
  if (
    !environment.MYSQL_HOST ||
    !environment.MYSQL_PORT ||
    !environment.MYSQL_USER ||
    !environment.MYSQL_PASSWORD ||
    !environment.MYSQL_DATABASE
  )
    return false;

  const client = mysql.createConnection({
    host: environment.MYSQL_HOST,
    port: parseInt(environment.MYSQL_PORT),
    user: environment.MYSQL_USER,
    password: environment.MYSQL_PASSWORD,
    database: environment.MYSQL_DATABASE,
  });

  return new Promise((resolve) => {
    client.connect((err) => {
      if (err) {
        console.error("Failed to connect to the MySQL database:", err.message);
        resolve(false);
      } else {
        console.log("\nMySQL database connection verified successfully!\n");
        client.end();
        resolve(true);
      }
    });
  });
}

async function verifyRedisConnection() {
  if (
    !environment.REDIS_HOST ||
    !environment.REDIS_PORT ||
    !environment.REDIS_USERNAME ||
    !environment.REDIS_PASSWORD
  )
    return false;

  const client = createClient({
    username: environment.REDIS_USERNAME,
    password: environment.REDIS_PASSWORD,
    socket: {
      host: environment.REDIS_HOST,
      port: parseInt(environment.REDIS_PORT),
    },
  });

  return new Promise((resolve) => {
    client.on("ready", () => {
      console.log("\nRedis connection verified successfully!\n");
      client.quit();
      resolve(true);
    });

    client.connect().catch((err) => {
      console.error("Error connecting to Redis:", err.message);
      resolve(false);
    });
  });
}

async function verifyGeminiAPIKey() {
  if (!environment.GEMINI_API_KEY) return false;

  if (environment.GEMINI_API_KEY === "-1") return true;

  const ai = new GoogleGenerativeAI(environment.GEMINI_API_KEY);
  const model = ai.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  try {
    const result = await model.generateContent(
      "Explain how AI works in a few words"
    );

    if (!result.response.text()) {
      console.error("Failed to verify Gemini API key:", result.response);
      return false;
    } else {
      console.log("Gemini API key verified successfully!\n");
      return true;
    }
  } catch (error: any) {
    console.error("Failed to verify Gemini API key:", error.message);
    return false;
  }
}

async function verifyNamelessAPI() {
  if (!environment.NAMELESSMC_API_URL || !environment.NAMELESSMC_API_KEY)
    return false;

  if (
    environment.NAMELESSMC_API_URL === "-1" ||
    environment.NAMELESSMC_API_KEY === "-1"
  )
    return true;

  try {
    const response = await fetch(`${environment.NAMELESSMC_API_URL}/info`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${environment.NAMELESSMC_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to verify NamelessMC API:", response.statusText);
      return false;
    } else {
      console.log("NamelessMC API verified successfully!\n");
      return true;
    }
  } catch (error: any) {
    console.error("Failed to verify NamelessMC API:", error.message);
    return false;
  }
}

async function verifyMCStatisticsSecret() {
  if (!environment.MCSTATISTICS_SECRET) return false;

  if (environment.MCSTATISTICS_SECRET === "-1") return true;

  try {
    const response = await fetch(
      `https://api.mcstatistics.org/v1/information`,
      {
        method: "GET",
        headers: {
          "X-MCStatistics-Secret": environment.MCSTATISTICS_SECRET!,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to verify MCStatistics API:", response.statusText);
      return false;
    } else {
      console.log("MCStatistics API verified successfully!\n");
      return true;
    }
  } catch (error: any) {
    console.error("Failed to verify MCStatistics API:", error.message);
    return false;
  }
}

function saveEnvironmentToFile() {
  if (
    !environment.APP_TOKEN ||
    !environment.MYSQL_HOST ||
    !environment.MYSQL_PORT ||
    !environment.MYSQL_USER ||
    !environment.MYSQL_PASSWORD ||
    !environment.REDIS_HOST ||
    !environment.REDIS_PORT
  ) {
    console.error(
      "Environment is incomplete. Please complete the setup before saving."
    );
    return;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const templateFilePath = path.join(__dirname, "..", "..", ".env.example");
  if (!fs.existsSync(templateFilePath)) {
    console.error(
      "Template file .env.example not found. Please ensure it exists in the root directory."
    );
    process.exit(1);
  }

  const templateContent = fs.readFileSync(templateFilePath, "utf-8");
  let environmentContent = templateContent;

  Object.entries(environment).forEach(([key, value]) => {
    if (value === "-1" || value === undefined) {
      value = "";
      environment[key as keyof typeof environment] = value;
    }

    environmentContent = environmentContent.replace(`YOUR_${key}`, value);
  });

  const envFilePath = path.join(__dirname, "..", "..", ".env");

  if (fs.existsSync(envFilePath)) fs.unlinkSync(envFilePath);

  fs.writeFileSync(envFilePath, environmentContent, "utf-8");
  console.log(`Environment saved to ${envFilePath}`);
}
