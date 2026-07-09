#!/bin/bash
awk '
/^      \/\/ Fetch Items/ {
    print "      // Fetch Items";
    print "      const items = await db.select({";
    print "        id: invoiceItems.id,";
    print "        invoiceId: invoiceItems.invoiceId,";
    print "        productId: invoiceItems.productId,";
    print "        productName: invoiceItems.productName,";
    print "        productCode: invoiceItems.productCode,";
    print "        unit: invoiceItems.unit,";
    print "        quantity: invoiceItems.quantity,";
    print "        price: invoiceItems.price,";
    print "        totalPrice: invoiceItems.totalPrice,";
    print "        hasVat: invoiceItems.hasVat,";
    print "        vatRate: invoiceItems.vatRate,";
    print "        warehouseId: products.warehouseId";
    print "      })";
    print "      .from(invoiceItems)";
    print "      .leftJoin(products, eq(invoiceItems.productId, products.id))";
    print "      .where(eq(invoiceItems.invoiceId, id));";
    skip = 1;
    next;
}
skip && /^      const items = / { skip = 0; next; }
{ if (!skip) print $0; }
' server.ts > tmp.ts && mv tmp.ts server.ts
