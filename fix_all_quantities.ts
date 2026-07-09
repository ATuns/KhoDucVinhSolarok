import { db } from './src/db/index.js';
import { products, stockTransactions } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  console.log("Recalculating all product quantities from stock transactions...");
  
  const allProds = await db.select().from(products);
  const allTxs = await db.select().from(stockTransactions);
  
  const qtyMap = new Map<number, number>();
  for (const tx of allTxs) {
    const current = qtyMap.get(tx.productId) || 0;
    if (tx.type === "NHAP" || tx.type === "BO_GHI_SO") {
      qtyMap.set(tx.productId, current + tx.quantity);
    } else if (tx.type === "XUAT" || tx.type === "GHI_SO") {
      qtyMap.set(tx.productId, current - tx.quantity);
    }
  }
  
  let updatedCount = 0;
  for (const p of allProds) {
    const calculated = qtyMap.get(p.id) || 0;
    if (p.quantity !== calculated) {
      console.log(`Product ${p.id} (${p.name}): DB says ${p.quantity}, but history says ${calculated}. Fixing...`);
      await db.update(products).set({ quantity: calculated }).where(eq(products.id, p.id));
      updatedCount++;
    }
  }
  
  console.log(`Done. Updated ${updatedCount} products.`);
  process.exit(0);
}
run().catch(console.error);
