#!/bin/bash
awk '
/^  warehouseId: integer/ {
    print $0;
    print "  docNumber: text(\x27doc_number\x27),";
    print "  partnerName: text(\x27partner_name\x27),";
    print "  unitPrice: integer(\x27unit_price\x27),";
    next;
}
{ print $0; }
' src/db/schema.ts > tmp.ts && mv tmp.ts src/db/schema.ts
