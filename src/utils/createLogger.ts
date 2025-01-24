import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export enum LoggerOptions {
  Debug = 'debug',
  Error = 'error',
  Warning = 'warning',
}

export type LoggerType = {
  write: (message: any) => void;
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

  const fileDir = path.join(
    __dirname,
    '..',
    '..',
    'ApplicationLogs',
    logger + 's'
  );

  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

  const filePath = path.join(fileDir, fileName);
  const fileWriteStream = fs.createWriteStream(filePath, { flags: 'a' });

  const timeStamp = date.toISOString();

  fileWriteStream.write(`[${timeStamp}] START OF ${logger.toUpperCase()}\n`);

  return {
    write: (message: any) => {
      if (logger !== 'warning') {
        fileWriteStream.write(
          (logger === 'debug' ? `[${timeStamp}] ` : '') + `${message}\n`
        );
      } else {
        fileWriteStream.write(`${message}\n`);
      }
    },
    close: () => {
      fileWriteStream.end(`[${timeStamp}] END OF ${logger.toUpperCase()}\n`);
    },
  };
}

export function createWarning(warning: string, result: string, fix: string, fileName: string) {
  const warningLogger = createLogger(
    fileName,
    LoggerOptions.Warning,
    true
  );

  warningLogger.write(`Warning: ${warning}`);
  warningLogger.write(`Result: ${result}`);
  warningLogger.write(`Fix: ${fix}`);

  warningLogger.close();

  console.log(
    `[Warning] ${warning}. Check ApplicationLogs/warnings for more info.`
  );
};