import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export default function (publicPathToFile?: string) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToPublic = path.join(__dirname, '..', '..', 'public');

  if (publicPathToFile) {
    const filePath = path.join(pathToPublic, publicPathToFile);
    const fileData = fs.readFileSync(filePath, 'utf-8');

    return {
      fileData,
      pathToPublic,
      filePath,
    };
  }

  return {
    pathToPublic,
  };
}
