import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  try {
    await db.execute(sql`ALTER TABLE invoices ADD COLUMN bank_account_id integer REFERENCES bank_accounts(id) ON DELETE SET NULL;`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN bank_account_id integer REFERENCES bank_accounts(id) ON DELETE SET NULL;`);
    console.log("Altered successfully.");
  } catch (e) {
    console.log(e);
  }
  process.exit(0);
}
run();
