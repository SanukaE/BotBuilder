import mysql from 'mysql2';
import 'dotenv/config';

const dbPool = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT!),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
  })
  .promise();

export default dbPool;
