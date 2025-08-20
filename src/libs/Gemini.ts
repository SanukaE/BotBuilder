import { GoogleGenAI } from "@google/genai";
import { createWarning } from "#utils/createLogger.js";
import getConfig from "#utils/getConfig.js";

export default function () {
  const geminiAPIKey = process.env.GEMINI_API_KEY;
  const { geminiModel, disabledCategories } = getConfig(
    "ai",
    "application"
  ) as { geminiModel: string; disabledCategories: string[] };

  if (!geminiAPIKey || (disabledCategories as string[]).includes("AI"))
    return { enabled: false };

  if (!geminiModel)
    createWarning(
      "geminiModel is not set",
      'All AI required features will be using "gemini-2.5-flash" model',
      "Please set a model to use in the ai config",
      "Gemini-libs"
    );

  const genAI = new GoogleGenAI({ apiKey: geminiAPIKey });
  const fileManager = genAI.files;

  const model = genAI.models;
  const chat = genAI.chats;

  return {
    enabled: true,
    genAI,
    model,
    chat,
    fileManager,
  };
}
