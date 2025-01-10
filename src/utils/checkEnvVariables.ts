import { createLogger, LoggerOptions } from './createLogger.js';

export default function checkEnvVariables() {
  const requiredVariables = [
    'APP_TOKEN',
    'MYSQL_HOST',
    'MYSQL_PORT',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_USERNAME',
    'REDIS_PASSWORD',
  ];
  const optionalVariables = [
    'NAMELESSMC_API_URL',
    'NAMELESSMC_API_KEY',
    'GEMINI_API_KEY',
    'MCSTATISTICS_SECRET',
  ];

  requiredVariables.forEach((variable) => {
    if (!process.env[variable]) {
      console.log(`Missing ${variable} from your .env file.`);
      process.exit(1);
    }
  });

  let missingVariables: string[] = [];

  optionalVariables.forEach((variable) => {
    if (!process.env[variable]) {
      switch (variable) {
        case 'NAMELESSMC_API_URL':
        case 'NAMELESSMC_API_KEY':
          missingVariables.push('namelessMC');
          break;

        case 'GEMINI_API_KEY':
          missingVariables.push('AI');
          break;

        case 'MCSTATISTICS_SECRET':
          missingVariables.push('mcStatistics');
          break;
      }
    }
  });

  if (missingVariables.length > 0) {
    const warningLogger = createLogger(
      'checkEnvVariables-util',
      LoggerOptions.Warning,
      true
    );
    warningLogger.write(
      'Warning: Missing some environment variables. Please check your .env file.'
    );
    warningLogger.write(
      'Result: Certain commands will not work as intended & some modules related will be disabled.'
    );
    warningLogger.write(
      'Fix: Check your .env file and set any missing variables.'
    );
    warningLogger.close();
  }

  return missingVariables;
}
