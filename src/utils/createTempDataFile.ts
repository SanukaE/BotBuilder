import { fileURLToPath } from 'url';
import path from 'path';
import fs, { WriteStream } from 'fs';

/**
 * Creates a temporary file with optional data and automatic cleanup after expiration.
 *
 * @param fileName - The name of the temporary file to be created
 * @param data - Optional string or buffer data to write to the file
 * @param expire - Time in milliseconds after which the file will be deleted (default: 60000ms)
 * @returns {WriteStream | undefined} Returns a WriteStream if no data is provided, undefined otherwise
 *
 * @remarks
 * The file is created in a 'temp' directory relative to the module location.
 * If the 'temp' directory doesn't exist, it will be created.
 * If data is provided, it's written synchronously and the file is automatically deleted after the expire time.
 * If no data is provided, returns a WriteStream for manual writing and the file is still deleted after expire time.
 *
 * @example
 * ```typescript
 * // With data
 * createTempDataFile('test.txt', 'Hello World', 30000);
 *
 * // Without data (streaming)
 * const stream = createTempDataFile('test.txt');
 * stream.write('Hello World');
 * ```
 */
export default function (
  fileName: string,
  data?: string | NodeJS.ArrayBufferView,
  expire = 60_000
): WriteStream | undefined {
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
