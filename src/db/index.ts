import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { sql } from 'drizzle-orm';

// Function to create a new connection pool.
export const createPool = () => {
  // Hardcoded Supabase connection string
  // NOTE: If deploying to Render, and you get connection errors, you may need to use 
  // the IPv4 Connection Pooler string provided by Supabase (usually port 6543)
  const connectionString = "postgresql://postgres:atuan0987231270@db.rwxjjxwjyqmqfioxjrmt.supabase.co:5432/postgres";
  
  return new Pool({
    connectionString: connectionString,
    connectionTimeoutMillis: 15000,
    ssl: {
      rejectUnauthorized: false
    }
  });
};

// Create a pool instance.
const pool = createPool();

// Prevent unhandled pool-level errors from crashing the application
pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
export * from './schema.ts';

// Dynamic feature detection for unaccent
export let isUnaccentSupported = false;
export const unaccentConfig = {
  isSupported: false
};

export function getIsUnaccentSupported() {
  return unaccentConfig.isSupported || isUnaccentSupported;
}

export async function detectUnaccentSupport() {
  try {
    // Try to create the extension first
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS unaccent;`);
      console.log("Attempted to create 'unaccent' extension.");
    } catch (createErr) {
      console.warn("Could not create 'unaccent' extension, it might already exist or require superuser privileges:", createErr);
    }

    // Attempt to run a simple unaccent query
    await db.execute(sql`SELECT unaccent('a');`);
    isUnaccentSupported = true;
    unaccentConfig.isSupported = true;
    console.log("Database 'unaccent' function is supported and active.");
  } catch (e) {
    console.warn("Database 'unaccent' function is NOT supported on this database instance. Standard ILIKE will be used as a fallback.");
    isUnaccentSupported = false;
    unaccentConfig.isSupported = false;
  }
}
