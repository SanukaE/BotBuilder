import MySQL from '#libs/MySQL.js';
import fs from 'fs';
import getAllFiles from '#utils/getAllFiles.js';
import Redis from '#libs/Redis.js';
import getPublicFile from '#utils/getPublicFile.js';

export default async function () {
  const tables = getAllFiles(getPublicFile('sql')!.filePath);

  for (const table of tables) {
    const tableSQL = fs.readFileSync(table, 'utf-8');
    await MySQL.query(tableSQL);
  }

  Redis.on('connect', () => console.log(`[System] Connected to Redis`));
  Redis.on('error', (error) =>
    console.error(
      `[Error] Failed to perform action with redis: ${error.message || error}`
    )
  );

  await Redis.connect();
}
