import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  const aggResult = await db.execute(sql`
      WITH po_calc AS (
        SELECT 
           po.id,
           po.supplier_id,
           po.custom_supplier_name,
           po.document_code,
           po.po_number,
           po.total_amount,
           po.created_at,
           COALESCE(d.total_dep, 0) as actual_dep,
           CASE 
             WHEN po.status IN ('TM', 'CK') THEN GREATEST(po.total_amount, COALESCE(d.total_dep, 0))
             ELSE COALESCE(d.total_dep, 0)
           END as effective_paid,
           COALESCE(d.deposits_list, '[]'::json) as deposits_list
        FROM purchase_orders po
        LEFT JOIN (
          SELECT 
             po_id, 
             SUM(amount) as total_dep,
             json_agg(
               json_build_object(
                 'id', id,
                 'amount', amount,
                 'paymentMethod', payment_method,
                 'createdAt', created_at
               )
             ) as deposits_list
          FROM purchase_order_deposits
          GROUP BY po_id
        ) d ON d.po_id = po.id
        WHERE po.is_recorded = true
      ),
      po_debts AS (
        SELECT 
           COALESCE(poc.supplier_id::text, poc.custom_supplier_name, 'Nhà cung cấp lẻ') as "partnerId", 
           COALESCE(s.name, poc.custom_supplier_name, 'Nhà cung cấp lẻ') as "partnerName", 
           s.phone as "partnerPhone",
          'SUPPLIER' as "type",
          COUNT(poc.id)::int as "unpaidCount",
          SUM(poc.total_amount)::bigint as "totalAmount",
          SUM(poc.effective_paid)::bigint as "totalDeposits",
          json_agg(
            json_build_object(
              'id', poc.id,
              'documentCode', poc.document_code,
              'totalAmount', poc.total_amount,
              'deposit', poc.actual_dep
            )
          ) as "documents"
        FROM po_calc poc
        LEFT JOIN suppliers s ON poc.supplier_id = s.id
        WHERE poc.total_amount <> poc.effective_paid
        GROUP BY 1, 2, 3
      )
      SELECT * FROM po_debts
  `);
  console.log(JSON.stringify(aggResult.rows || aggResult, null, 2));
  process.exit(0);
}
run();
