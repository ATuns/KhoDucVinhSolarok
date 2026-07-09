import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
});

async function run() {
  await client.connect();
  try {
    const res = await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    console.log('Extension created successfully:', res);
  } catch (e) {
    console.error('Error creating extension:', e);
  } finally {
    await client.end();
  }
}
run();
