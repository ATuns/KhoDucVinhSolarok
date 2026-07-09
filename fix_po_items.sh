#!/bin/bash
awk '
/^    const items = await db.select\(\).from\(purchaseOrderItems\).where\(eq\(purchaseOrderItems.poId, id\)\);/ {
    print "    const items = await db.select({";
    print "        id: purchaseOrderItems.id,";
    print "        poId: purchaseOrderItems.poId,";
    print "        productId: purchaseOrderItems.productId,";
    print "        productName: purchaseOrderItems.productName,";
    print "        productCode: purchaseOrderItems.productCode,";
    print "        unit: purchaseOrderItems.unit,";
    print "        quantity: purchaseOrderItems.quantity,";
    print "        price: purchaseOrderItems.price,";
    print "        totalPrice: purchaseOrderItems.totalPrice,";
    print "        hasVat: purchaseOrderItems.hasVat,";
    print "        vatRate: purchaseOrderItems.vatRate,";
    print "        warehouseId: products.warehouseId";
    print "    })";
    print "    .from(purchaseOrderItems)";
    print "    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))";
    print "    .where(eq(purchaseOrderItems.poId, id));";
    next;
}
{ print $0; }
' src/routes/purchaseOrders.ts > tmp.ts && mv tmp.ts src/routes/purchaseOrders.ts
