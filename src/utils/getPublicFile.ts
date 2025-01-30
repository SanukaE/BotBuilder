import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export default function (publicPathToFile: string, readFileContent = false) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToPublic = path.join(__dirname, '..', '..', 'public');
  const filePath = path.join(pathToPublic, publicPathToFile);

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
