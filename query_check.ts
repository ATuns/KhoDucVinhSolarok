import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  const aggResult = await db.execute(sql`
      WITH invoice_calc AS (
        SELECT 
           i.id,
           i.status,
           i.document_code,
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
      SELECT * FROM invoice_calc WHERE total_amount <> effective_paid AND status IN ('TM', 'CK');
  `);
  console.log("Invoices:", aggResult.rows);

  const poResult = await db.execute(sql`
      WITH po_calc AS (
        SELECT 
           po.id,
           po.status,
           po.document_code,
           po.total_amount,
           COALESCE(d.total_dep, 0) as actual_dep,
           CASE 
             WHEN po.status IN ('TM', 'CK') THEN GREATEST(po.total_amount, COALESCE(d.total_dep, 0))
             ELSE COALESCE(d.total_dep, 0)
           END as effective_paid
        FROM purchase_orders po
        LEFT JOIN (
          SELECT po_id, SUM(amount) as total_dep FROM purchase_order_deposits GROUP BY po_id
        ) d ON d.po_id = po.id
        WHERE po.is_recorded = true
      )
      SELECT * FROM po_calc WHERE total_amount <> effective_paid AND status IN ('TM', 'CK');
  `);
  console.log("POs:", poResult.rows);
  process.exit(0);
}
run();
