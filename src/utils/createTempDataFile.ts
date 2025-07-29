import { fileURLToPath } from "url";
import path from "path";
import fs, { WriteStream } from "fs";
import wav from "wav";

/**
 * Creates a temporary file with optional data and automatic cleanup after expiration.
 *
 * @param fileName - The name of the temporary file to be created
 * @param data - Optional string or buffer data to write to the file
 * @param expire - Time in milliseconds after which the file will be deleted (default: 60000ms)
 * @param options - Additional options for file writing
 * @returns {WriteStream | Promise<void> | undefined} Returns a WriteStream if no data is provided, Promise<void> for audio files, undefined for regular files with data
 *
 * @remarks
 * The file is created in a 'temp' directory relative to the module location.
 * If the 'temp' directory doesn't exist, it will be created.
 * If data is provided, it's written synchronously and the file is automatically deleted after the expire time.
 * If no data is provided, returns a WriteStream for manual writing and the file is still deleted after expire time.
 * For WAV files, properly formats PCM data with WAV headers.
 *
 * @example
 * ```typescript
 * // With text data
 * createTempDataFile('test.txt', 'Hello World', 30000);
 *
 * // With audio data (returns Promise)
 * await createTempDataFile('audio.wav', audioBuffer, 30000, { isAudio: true });
 *
 * // Without data (streaming)
 * const stream = createTempDataFile('test.txt');
 * stream.write('Hello World');
 * ```
 */
export default function (
  fileName: string,
  data?: string | NodeJS.ArrayBufferView,
  expire = 60_000,
  options?: {
    binary?: boolean;
    isAudio?: boolean;
    channels?: number;
    sampleRate?: number;
    bitDepth?: number;
  }
): WriteStream | Promise<void> | undefined {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToTempFiles = path.join(__dirname, "..", "..", "temp");

  if (!fs.existsSync(pathToTempFiles)) fs.mkdirSync(pathToTempFiles);

  const filePath = path.join(pathToTempFiles, fileName);

  if (data) {
    // Handle audio files with proper WAV formatting
    if (options?.isAudio && fileName.endsWith(".wav")) {
      return saveWaveFile(
        filePath,
        data as Buffer,
        options.channels || 1,
        options.sampleRate || 24000,
        (options.bitDepth || 16) / 8,
        expire
      );
    } else {
      // Handle regular files
      const writeOptions = options?.binary
        ? {}
        : { encoding: "utf-8" as const };
      fs.writeFileSync(filePath, data, writeOptions);

      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, expire);
    }
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

/**
 * Saves PCM audio data as a properly formatted WAV file
 */
async function saveWaveFile(
  filename: string,
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2,
  expire = 60_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on("finish", () => {
      // Set up automatic cleanup
      setTimeout(() => {
        if (fs.existsSync(filename)) {
          fs.unlinkSync(filename);
        }
      }, expire);
      resolve();
    });

    writer.on("error", reject);

    writer.write(pcmData);
    writer.end();
  });
}
