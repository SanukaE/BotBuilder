import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

export default function (
  fileName: string,
  data?: string | NodeJS.ArrayBufferView,
  expire = 60_000
) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToTempFiles = path.join(__dirname, '..', '..', 'temp');

  if (!fs.existsSync(pathToTempFiles)) fs.mkdirSync(pathToTempFiles);

  const filePath = path.join(pathToTempFiles, fileName);

  if (data) {
    fs.writeFileSync(filePath, data, {
      encoding: 'utf-8',
    });

    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, expire);
  } else {
    const fileStream = fs.createWriteStream(filePath);

    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        if (!fileStream.closed) fileStream.close();
        fs.unlinkSync(filePath);
      }
    }, expire);

    return fileStream;
  }
}
