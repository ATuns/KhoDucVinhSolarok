import { db } from "./src/db/index.ts";
import { customers } from "./src/db/schema.ts";

async function run() {
  const result = await db.select().from(customers);
  console.log("Customers in DB:", result);
  process.exit(0);
}
run();
