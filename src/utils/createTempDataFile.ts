import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

export default function (fileName: string, data: any, expire = 60_000) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToTempFiles = path.join(__dirname, '..', '..', 'temp');

  if (!fs.existsSync(pathToTempFiles)) fs.mkdirSync(pathToTempFiles);

  const filePath = path.join(pathToTempFiles, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data), {
    encoding: 'utf-8',
  });

  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }, expire);
}
