import fs from 'fs';
import path from 'path';
import { createWarning } from './createLogger.js';

/**
 * Retrieves an array of file or directory paths from a specified directory.
 * 
 * @param directory - The path to the directory to scan
 * @param isFoldersOnly - If true, returns only directory paths. If false, returns only file paths. Defaults to false
 * @returns An array of strings containing the full paths of files or directories
 * 
 * @remarks
 * - If the specified directory does not exist, returns an empty array and creates a warning
 * - Uses synchronous file system operations
 * - Paths returned are absolute paths joined with the directory parameter
 * 
 * @example
 * ```typescript
 * // Get all files in directory
 * const files = getAllFiles('./src');
 * 
 * // Get only folders in directory
 * const folders = getAllFiles('./src', true);
 * ```
 */
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
