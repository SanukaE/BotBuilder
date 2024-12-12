import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createLogger, LoggerOptions } from './createLogger.js';
import config from '../../config.json' assert { type: 'json' };
import 'dotenv/config';

export default function () {
  const geminiAPIKey = process.env.GEMINI_API_KEY;
  const { geminiModel } = config;

  if (!geminiAPIKey) {
    const warningLogger = createLogger(
      `initializeAI-util`,
      LoggerOptions.Warning,
      true
    );
    warningLogger.write('Warning: GEMINI_API_KEY is not set.');
    warningLogger.write('Result: All AI required features will be disabled.');
    warningLogger.write(
      'Fix: Please check if your API Key is correct in the .env file.'
    );
    warningLogger.close();
    return { enabled: false };
  }

  if (!geminiModel) {
    const warningLogger = createLogger(
      `initializeAI-util`,
      LoggerOptions.Warning,
      true
    );
    warningLogger.write('Warning: geminiModel is not set.');
    warningLogger.write(
      'Result: All AI required features will be using "gemini-1.5-flash" model.'
    );
    warningLogger.write(
      'Fix: Please set a model to use in the config.json file.'
    );
    warningLogger.close();
  }

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
