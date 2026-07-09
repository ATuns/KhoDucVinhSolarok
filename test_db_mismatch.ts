import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  const result = await db.execute(sql`SELECT id, status, document_code FROM invoices WHERE document_code LIKE 'TM-%' AND status <> 'TM' OR document_code LIKE 'CK-%' AND status <> 'CK'`);
  console.log(result.rows);
  process.exit(0);
}
run();
