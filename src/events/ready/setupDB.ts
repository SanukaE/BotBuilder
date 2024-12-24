import { fileURLToPath } from 'url';
import dbPool from '#utils/dbPool.js';
import fs from 'fs';
import path from 'path';
import getAllFiles from '#utils/getAllFiles.js';

export default async function () {
  await dbPool.query('CREATE DATABASE IF NOT EXISTS botbuilder');
  await dbPool.query('USE botbuilder');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const tables = getAllFiles(
    path.join(__dirname, '..', '..', '..', '..', 'public', 'sql')
  );

  for (const table of tables) {
    const tableSQL = fs.readFileSync(table, 'utf-8');
    await dbPool.query(tableSQL);
  }
}
