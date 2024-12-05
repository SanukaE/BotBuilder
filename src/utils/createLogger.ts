import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export enum LoggerOptions {
  Debug = 'debugs',
  Error = 'errors',
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
  const fileName = `${name}.log`;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const fileDir = path.join(__dirname, '..', '..', logger);

  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir);

  const filePath = path.join(fileDir, fileName);
  const fileWriteStream = fs.createWriteStream(filePath);

  const timeStamp = date.toISOString();
  if (logger === 'debugs')
    fileWriteStream.write(`[${timeStamp}] START OF DEBUG\n`);

  return {
    write: (message: string) => {
      fileWriteStream.write(
        (logger === 'debugs' ? `[${timeStamp}]` : '') + ` ${message}\n`
      );
    },
    close: () => {
      if (logger === 'debugs')
        fileWriteStream.end(`[${timeStamp}] END OF DEBUG`);
    },
  };
}
