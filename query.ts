import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  const res = await db.execute(sql`
    WITH invoice_calc AS (
      SELECT 
          i.id,
          i.status,
          i.total_amount,
          COALESCE(d.total_dep, 0) as actual_dep,
          CASE 
            WHEN i.status IN ('TM', 'CK') THEN GREATEST(i.total_amount, COALESCE(d.total_dep, 0))
            ELSE COALESCE(d.total_dep, 0)
          END as effective_paid
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) as total_dep FROM deposits GROUP BY invoice_id
      ) d ON d.invoice_id = i.id
      WHERE i.is_recorded = true
    )
    SELECT id, status, total_amount, actual_dep, effective_paid, (total_amount <> effective_paid) as diff 
    FROM invoice_calc WHERE status IN ('TM', 'CK');
  `);
  console.log(res.rows || res);
  process.exit(0);
}
run();
