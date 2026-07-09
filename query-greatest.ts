import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  const result = await db.execute(sql`SELECT GREATEST(NULL, 0) as g`);
  console.log(result.rows);
  process.exit(0);
}
run();
