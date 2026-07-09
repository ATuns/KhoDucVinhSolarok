import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  const aggResult = await db.execute(sql`
      WITH invoice_calc AS (
        SELECT 
           i.id,
           i.customer_id,
           i.custom_customer_name,
           i.document_code,
           i.invoice_number,
           i.total_amount,
           i.status,
           i.created_at,
           COALESCE(d.total_dep, 0) as actual_dep,
           CASE 
             WHEN i.status IN ('TM', 'CK') THEN i.total_amount
             ELSE COALESCE(d.total_dep, 0)
           END as effective_paid,
           COALESCE(d.deposits_list, '[]'::json) as deposits_list
        FROM invoices i
        LEFT JOIN (
          SELECT 
             invoice_id, 
             SUM(amount) as total_dep,
             json_agg(
               json_build_object(
                 'id', id,
                 'amount', amount,
                 'paymentMethod', payment_method,
                 'createdAt', created_at
               )
             ) as deposits_list
          FROM deposits
          GROUP BY invoice_id
        ) d ON d.invoice_id = i.id
        WHERE i.is_recorded = true
      )
      SELECT * FROM invoice_calc WHERE total_amount <> effective_paid AND status IN ('TM', 'CK');
  `);
  console.log(aggResult.rows);
  process.exit(0);
}
run();
