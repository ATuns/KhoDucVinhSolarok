import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file.
dotenv.config();

const dbUrl = "postgresql://postgres.rwxjjxwjyqmqfioxjrmt:atuan0987231270@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // Output directory for migrations.
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: dbUrl ? {
    url: dbUrl
  } : {
    host: process.env.SQL_HOST!,
    user: process.env.SQL_ADMIN_USER!,
    password: process.env.SQL_ADMIN_PASSWORD!,
    database: process.env.SQL_DB_NAME!,
    ssl: false,
  },
  verbose: true,
});
