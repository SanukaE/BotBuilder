import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Retrieves file paths and optionally reads file content from the public directory
 * @param publicPathToFile - Relative path to the file within the public directory
 * @param readFileContent - Flag to determine if file content should be read (default: false)
 * @returns {Object | undefined} Object containing path information and optionally file content, or undefined if file doesn't exist
 * @returns {string} [fileData] - Content of the file if readFileContent is true
 * @returns {string} pathToPublic - Absolute path to the public directory
 * @returns {string} filePath - Absolute path to the requested file
 */
export default function (publicPathToFile: string, readFileContent = false): object | undefined {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToPublic = path.join(__dirname, '..', '..', 'public');
  const filePath = path.join(pathToPublic, publicPathToFile);

  if (!fs.existsSync(filePath)) return;

  if (readFileContent) {
    const fileData = fs.readFileSync(filePath, 'utf-8');

    return {
      fileData,
      pathToPublic,
      filePath,
    };
  }

  return {
    pathToPublic,
    filePath,
  };
}
