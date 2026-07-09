import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  const result = await db.execute(sql`
    SELECT id, status, document_code, total_amount 
    FROM invoices 
    WHERE status IN ('TM', 'CK') AND id IN (
      SELECT id FROM invoices WHERE id = 185 OR id = 187
    )
  `);
  console.log(result.rows);
  process.exit(0);
}
run();
