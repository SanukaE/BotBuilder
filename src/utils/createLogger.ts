import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export enum LoggerOptions {
  Debug = 'debug',
  Error = 'error',
  Warning = 'warning',
}

export type LoggerType = {
  write: (message: string) => void;
  close: () => void;
};

export function createLogger(
  name: string,
  logger: LoggerOptions,
  isEnabled?: boolean
): LoggerType {
  if (!isEnabled) {
    return {
      write: () => {},
      close: () => {},
    };
  }

  const date = new Date();
  const fileName = `${name}.txt`;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const fileDir = path.join(__dirname, '..', '..', 'actionLogs', logger + 's');

  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

  const filePath = path.join(fileDir, fileName);
  const fileWriteStream = fs.createWriteStream(filePath, { flags: 'a' });

  const timeStamp = date.toISOString();

  fileWriteStream.write(`[${timeStamp}] START OF ${logger.toUpperCase()}\n`);

  return {
    write: (message: string) => {
      if (logger !== 'warning') {
        fileWriteStream.write(
          (logger === 'debug' ? `[${timeStamp}] ` : '') + `${message}\n`
        );
      } else {
        fileWriteStream.write(`${message}\n`);
      }
    },
    close: () => {
      fileWriteStream.end(`[${timeStamp}] END OF ${logger.toUpperCase()}`);
    },
  };
}
