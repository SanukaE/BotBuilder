import fs from 'fs';
import path from 'path';
import { createWarning } from './createLogger.js';

export default function (directory: string, isFoldersOnly = false) {
  let fileNames: string[] = [];

  if (!fs.existsSync(directory)) {
    createWarning(
      `File directory (${directory}) does not exist`,
      'An empty string[] was returned',
      'Create a file (TS) under the directory for TS compiler to include on production',
      'getAllFiles-utils'
    );
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
