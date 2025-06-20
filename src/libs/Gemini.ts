import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createWarning } from '#utils/createLogger.js';
import getConfig from '#utils/getConfig.js';

export default function () {
  const geminiAPIKey = process.env.GEMINI_API_KEY;
  const { geminiModel, disabledCategories } = getConfig("ai", "application") as { geminiModel: string; disabledCategories: string[] };

  if (!geminiAPIKey || (disabledCategories as string[]).includes('AI'))
    return { enabled: false };

  if (!geminiModel)
    createWarning(
      'geminiModel is not set',
      'All AI required features will be using "gemini-1.5-flash" model',
      'Please set a model to use in config.json',
      'Gemini-libs'
    );

  const genAI = new GoogleGenerativeAI(geminiAPIKey);
  const fileManager = new GoogleAIFileManager(geminiAPIKey);

  const model = genAI.getGenerativeModel({
    model: geminiModel || 'gemini-1.5-flash',
  });

  return {
    enabled: true,
    model,
    fileManager,
  };
}
