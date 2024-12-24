import { RowDataPacket } from 'mysql2';
import dbPool from './dbPool.js';

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
    const [rows] = await dbPool.query<RowDataPacket[]>(
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
