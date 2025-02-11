import { RowDataPacket } from 'mysql2';
import MySQL from '#libs/MySQL.js';

/**
 * Generates a unique API key of 64 characters length containing uppercase letters, lowercase letters, and numbers.
 * Checks for uniqueness in the database before returning the key.
 * 
 * @param maxAttempts - Maximum number of attempts to generate a unique key (default: 3)
 * @returns Promise that resolves to a unique API key string
 * @throws Error if unable to generate a unique key within the maximum attempts
 * 
 * @example
 * ```typescript
 * try {
 *   const apiKey = await generateAPIKey();
 *   console.log(apiKey); // e.g., "aB2cD3eF4..."
 * } catch (error) {
 *   console.error("Failed to generate API key:", error);
 * }
 * ```
 */
export default async function generateAPIKey(maxAttempts = 3) {
  let apiKey = '';

  let attempts = 0;
  const apiKeyLength = 64;

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  while (attempts < maxAttempts) {
    //for key generation
    for (let i = 0; i < apiKeyLength; i++) {
      const isNumber = Math.floor(Math.random() * 2); //0: character, 1: number

      if (isNumber) {
        const randomNum = Math.floor(Math.random() * numbers.length);
        apiKey += numbers.charAt(randomNum);
      } else {
        const isLowerCase = Math.floor(Math.random() * 2); //0: uppercase, 1: lowercase
        const randomChar = Math.floor(Math.random() * characters.length);

        if (isLowerCase) apiKey += characters.charAt(randomChar).toLowerCase();
        else apiKey += characters.charAt(randomChar);
      }
    }

    //check if key is unique
    const [rows] = await MySQL.query<RowDataPacket[]>(
      'SELECT apiKey FROM api_keys WHERE apikey = ?',
      [apiKey]
    );

    if (rows.length > 0) {
      attempts++;
      apiKey = '';
    } else return apiKey;
  }

  throw new Error(
    `Failed to generate unique API Key after ${maxAttempts} attempts.`
  );
}
