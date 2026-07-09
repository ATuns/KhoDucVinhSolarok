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
      ),
      invoice_debts AS (
        SELECT 
           COALESCE(c.id::text, ic.custom_customer_name, 'Khách lẻ') as "partnerId", 
           COALESCE(c.name, ic.custom_customer_name, 'Khách lẻ') as "partnerName", 
           c.phone as "partnerPhone",
          'CUSTOMER' as "type",
          COUNT(ic.id)::int as "unpaidCount",
          SUM(ic.total_amount)::double precision as "totalAmount",
          SUM(ic.effective_paid)::double precision as "totalDeposits",
          json_agg(
            json_build_object(
              'id', ic.id,
              'documentCode', ic.document_code,
              'invoiceNumber', ic.invoice_number,
              'totalAmount', ic.total_amount,
              'createdAt', ic.created_at,
              'deposit', ic.actual_dep,
              'depositsList', ic.deposits_list
            )
          ) as "documents"
        FROM invoice_calc ic
        LEFT JOIN customers c ON ic.customer_id = c.id
        WHERE ic.total_amount <> ic.effective_paid
        GROUP BY 1, 2, 3
      ),
      po_calc AS (
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
             WHEN po.status IN ('TM', 'CK') THEN po.total_amount
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
          SUM(poc.total_amount)::double precision as "totalAmount",
          SUM(poc.effective_paid)::double precision as "totalDeposits",
          json_agg(
            json_build_object(
              'id', poc.id,
              'documentCode', poc.document_code,
              'invoiceNumber', poc.po_number,
              'totalAmount', poc.total_amount,
              'createdAt', poc.created_at,
              'deposit', poc.actual_dep,
              'depositsList', poc.deposits_list
            )
          ) as "documents"
        FROM po_calc poc
        LEFT JOIN suppliers s ON poc.supplier_id = s.id
        WHERE poc.total_amount <> poc.effective_paid
        GROUP BY 1, 2, 3
      )
      SELECT * FROM invoice_debts
      UNION ALL
      SELECT * FROM po_debts
  `);
  console.log(JSON.stringify(aggResult.rows, null, 2));
  process.exit(0);
}
run();
