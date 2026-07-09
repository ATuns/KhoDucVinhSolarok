import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  const result = await db.execute(sql`SELECT id, status, document_code FROM invoices WHERE status LIKE 'CK %'`);
  console.log(result.rows);
  process.exit(0);
}
run();
