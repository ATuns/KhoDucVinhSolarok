#!/bin/bash
# Remove all the falsely inserted lines
sed -i '/if (!selectedWarehouse) {/d' src/components/WarehouseTab.tsx
sed -i '/return <WarehouseManager onSelectWarehouse={setSelectedWarehouse} \/>;/d' src/components/WarehouseTab.tsx

# Find the main return statement of WarehouseTab and insert it before that.
# The main return is at line 368. Wait, I can match exactly "return (" that is not preceded by spaces or only a few spaces.
# Actually, the main return has 2 spaces indent: "  return ("
# We can use awk to only insert at the FIRST "  return (".
awk '
BEGIN { done = 0; }
/^  return \(/ {
    if (!done) {
        print "  if (!selectedWarehouse) {"
        print "    return <WarehouseManager onSelectWarehouse={setSelectedWarehouse} />;"
        print "  }"
        print ""
        done = 1;
    }
}
{ print $0; }
' src/components/WarehouseTab.tsx > tmp.tsx && mv tmp.tsx src/components/WarehouseTab.tsx
