import { db, detectUnaccentSupport, isUnaccentSupported } from "./src/db/index.ts";
import { invoices, customers, purchaseOrders, suppliers } from "./src/db/schema.ts";
import { sql, eq, or, inArray } from "drizzle-orm";

async function run() {
  await detectUnaccentSupport();
  console.log("isUnaccentSupported:", isUnaccentSupported);

  const search = "hoa";
  const searchPattern = `%${search}%`;

  // Query invoices
  let customerIds: number[] = [];
  const customerMatches = await db.select({ id: customers.id })
    .from(customers)
    .where(sql`unaccent(${customers.name}) ILIKE unaccent(${searchPattern}::text)`);
  customerIds = customerMatches.map(c => c.id);
  console.log("customerIds for 'hoa':", customerIds);

  const searchOrs = [
    sql`unaccent(${invoices.invoiceNumber}) ILIKE unaccent(${searchPattern}::text)`,
    sql`unaccent(${invoices.documentCode}) ILIKE unaccent(${searchPattern}::text)`,
    sql`unaccent(${invoices.customCustomerName}) ILIKE unaccent(${searchPattern}::text)`
  ];
  if (customerIds.length > 0) {
    searchOrs.push(inArray(invoices.customerId, customerIds));
  }

  const list = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    customerName: sql`COALESCE(${invoices.customCustomerName}, ${customers.name})`,
  })
  .from(invoices)
  .leftJoin(customers, eq(invoices.customerId, customers.id))
  .where(or(...searchOrs));

  console.log("Matching invoices:", list);

  // Query purchase orders
  let supplierIds: number[] = [];
  const supplierMatches = await db.select({ id: suppliers.id })
    .from(suppliers)
    .where(sql`unaccent(${suppliers.name}) ILIKE unaccent(${searchPattern}::text)`);
  supplierIds = supplierMatches.map(c => c.id);
  console.log("supplierIds for 'hoa':", supplierIds);

  const poSearchOrs = [
    sql`unaccent(${purchaseOrders.poNumber}) ILIKE unaccent(${searchPattern}::text)`,
    sql`unaccent(${purchaseOrders.documentCode}) ILIKE unaccent(${searchPattern}::text)`,
    sql`unaccent(${purchaseOrders.customSupplierName}) ILIKE unaccent(${searchPattern}::text)`
  ];
  if (supplierIds.length > 0) {
    poSearchOrs.push(inArray(purchaseOrders.supplierId, supplierIds));
  }

  const poList = await db.select({
    id: purchaseOrders.id,
    poNumber: purchaseOrders.poNumber,
    supplierName: sql`COALESCE(${purchaseOrders.customSupplierName}, ${suppliers.name})`,
  })
  .from(purchaseOrders)
  .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
  .where(or(...poSearchOrs));

  console.log("Matching purchase orders:", poList);

  process.exit(0);
}
run();
