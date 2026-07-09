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
           i.created_at,
           COALESCE(d.total_dep, 0) as actual_dep,
           CASE 
             WHEN i.status IN ('TM', 'CK') THEN GREATEST(i.total_amount, COALESCE(d.total_dep, 0))
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
      ),
      invoice_debts AS (
        SELECT 
           COALESCE(c.id::text, ic.custom_customer_name, 'Khách lẻ') as "partnerId", 
           COALESCE(c.name, ic.custom_customer_name, 'Khách lẻ') as "partnerName", 
           c.phone as "partnerPhone",
          'CUSTOMER' as "type",
          COUNT(ic.id)::int as "unpaidCount",
          SUM(ic.total_amount)::bigint as "totalAmount",
          SUM(ic.effective_paid)::bigint as "totalDeposits",
          json_agg(
            json_build_object(
              'id', ic.id,
              'documentCode', ic.document_code,              
              'totalAmount', ic.total_amount,
              'deposit', ic.actual_dep
            )
          ) as "documents"
        FROM invoice_calc ic
        LEFT JOIN customers c ON ic.customer_id = c.id
        WHERE ic.total_amount <> ic.effective_paid
        GROUP BY 1, 2, 3
      )
      SELECT * FROM invoice_debts
  `);
  console.log(JSON.stringify(aggResult.rows || aggResult, null, 2));
  process.exit(0);
}
run();
