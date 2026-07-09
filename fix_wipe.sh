#!/bin/bash
awk '
BEGIN { skip = 0; }
/^        await tx.delete\(bankAccounts\);/ {
    print "        await tx.delete(bankAccounts);";
    print "        await tx.delete(warehouses);";
    next;
}
/^        await tx.delete\(purchaseOrderLogs\);/ {
    print "        await tx.delete(purchaseOrderLogs);";
    print "        await tx.delete(warehouseStocks);";
    next;
}
{ print $0; }
' server.ts > tmp.ts && mv tmp.ts server.ts
