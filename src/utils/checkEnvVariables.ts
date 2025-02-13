import { createWarning } from './createLogger.js';

/**
 * Checks for required and optional environment variables and handles missing variables.
 * 
 * @remarks
 * This function verifies the presence of required environment variables and checks for optional ones.
 * If any required variable is missing, the process will exit with code 1.
 * For optional variables, it tracks which features will be disabled due to missing variables.
 * 
 * The following features are affected by optional variables:
 * - namelessMC: Requires NAMELESSMC_API_URL and NAMELESSMC_API_KEY
 * - AI: Requires GEMINI_API_KEY
 * - mcStatistics: Requires MCSTATISTICS_SECRET
 * 
 * @returns An array of strings indicating which features are disabled due to missing optional variables
 * 
 * @throws Will exit process with code 1 if any required environment variable is missing
 * 
 * @example
 * ```typescript
 *  const missingFeatures = checkEnvVariables();
 *  // Returns ['AI', 'mcStatistics'] if those features' variables are missing
 * ```
 */
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
      console.log(`[Error] Missing ${variable} from your .env file`);
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

  if (missingVariables.length > 0)
    createWarning(
      'Missing some environment variables. Please check your .env file',
      'Certain actions/features will not work as intended & some modules related will be disabled',
      'Check your .env file and set any missing variables',
      'checkEnvVariables-util'
    );

  return missingVariables;
}
