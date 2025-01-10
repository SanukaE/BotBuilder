import { fileURLToPath } from 'url';
import MySQL from '#libs/MySQL.js';
import fs from 'fs';
import path from 'path';
import getAllFiles from '#utils/getAllFiles.js';
import Redis from '#libs/Redis.js';

export default async function () {
  await MySQL.query('CREATE DATABASE IF NOT EXISTS botbuilder');
  await MySQL.query('USE botbuilder');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const tables = getAllFiles(
    path.join(__dirname, '..', '..', '..', 'public', 'sql')
  );

  for (const table of tables) {
    const tableSQL = fs.readFileSync(table, 'utf-8');
    await MySQL.query(tableSQL);
  }

  Redis.on('connect', () => console.log(`[System] Connected to Redis!`));
  Redis.on('error', (error) =>
    console.error(`[Error] ${error.message || error}`)
  );

  await Redis.connect();
}
