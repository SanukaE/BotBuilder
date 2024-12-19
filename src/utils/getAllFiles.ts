import fs from 'fs';
import path from 'path';
import { createLogger, LoggerOptions } from './createLogger.js';

export default function (directory: string, isFoldersOnly = false) {
  let fileNames: string[] = [];

  if (!fs.existsSync(directory)) {
    const warningLogger = createLogger(
      `getAllFiles-utils`,
      LoggerOptions.Warning,
      true
    );

    warningLogger.write(
      `Warning: File directory (${directory}) does not exist.`
    );
    warningLogger.write('Result: An empty string[] was returned.');
    warningLogger.write(
      'Fix: Create a file (TS) under the directory for TS compiler to include on production.'
    );

    warningLogger.close();
    return fileNames;
  }

  const files = fs.readdirSync(directory, { withFileTypes: true });

  files.forEach((file) => {
    const filePath = path.join(directory, file.name);

    if (isFoldersOnly) {
      if (file.isDirectory()) {
        fileNames.push(filePath);
      }
    } else {
      if (file.isFile()) {
        fileNames.push(filePath);
      }
    }
  });

  return fileNames;
}
