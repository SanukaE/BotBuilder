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

/**
 * Creates a logger instance for writing logs to a file.
 * 
 * @param name - The name of the log file (without extension)
 * @param logger - The type of logger to create (debug, error, or warning)
 * @param isEnabled - Whether the logger should actually write logs or be a no-op. Defaults to true.
 * 
 * @returns A LoggerType object with methods to:
 * - write: Write a message to the log file
 * - close: Close the log file and write an end message
 * 
 * @remarks
 * - Creates log files in ApplicationLogs/<logger type> directory
 * - Adds timestamps to debug and error logs
 * - Log files are created in append mode
 * - If logger is disabled, returns no-op functions
 * - Automatically creates required directories if they don't exist
 * - Adds START and END markers with timestamps when opening/closing the log
 */
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

/**
 * Creates a warning log entry with structured information about an issue.
 * 
 * @param warning - The warning message describing the issue
 * @param result - The result or current state that triggered the warning
 * @param fix - The suggested fix or solution for the warning
 * @param fileName - The name of the file to write the warning log to
 * 
 * @remarks
 * - Creates a warning log file in ApplicationLogs/warnings directory
 * - Writes three lines: warning message, result, and suggested fix
 * - Also logs a condensed warning message to the console
 */
export function createWarning(warning: string, result: string, fix: string, fileName: string) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const fileDir = path.join(__dirname, '..', '..', 'ApplicationLogs', 'warnings', `${fileName}.txt`);

  if(fs.existsSync(fileDir)) {
    const fileData = fs.readFileSync(fileDir, 'utf-8');
    const warnings = fileData.split('\n').filter(line => line.startsWith('Warning:')).map(line => line.replace('Warning: ', '').trim());

    if(warnings.includes(warning)) return;
  }

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