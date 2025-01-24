import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createWarning } from '#utils/createLogger.js';
import config from '../../config.json' assert { type: 'json' };

export default function () {
  const geminiAPIKey = process.env.GEMINI_API_KEY;
  const { geminiModel, disabledCategories } = config;

  if (!geminiAPIKey || (disabledCategories as string[]).includes('AI')) {
    createWarning(
      'GEMINI_API_KEY is not set OR AI is disabled',
      'All AI required features will be disabled',
      'Please check if your API Key is correct in the .env file OR remove AI from config.json',
      'Gemini-libs'
    );
    return { enabled: false };
  }

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
