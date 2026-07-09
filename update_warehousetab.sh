#!/bin/bash

# 1. Update imports
sed -i 's/import { Product, StockTransaction/import { Product, StockTransaction, Warehouse/' src/components/WarehouseTab.tsx
sed -i '/import \* as xlsx from/a import { WarehouseManager } from "./WarehouseManager.tsx";\nimport { ChevronLeft } from "lucide-react";' src/components/WarehouseTab.tsx

# 2. Add selectedWarehouse state
sed -i '/const \[productsList, setProductsList\] = useState<Product\[\]>(\[\]);/a \  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);' src/components/WarehouseTab.tsx

# 3. Update fetchProducts
sed -i 's/if (filterInStock) params.append('\''inStock'\'', '\''true'\'');/if (filterInStock) params.append('\''inStock'\'', '\''true'\'');\n      if (selectedWarehouse) params.append('\''warehouseId'\'', selectedWarehouse.id.toString());/' src/components/WarehouseTab.tsx

# 4. Update handleAddProduct body to include warehouseId
sed -i 's/minStock: newMinStock,/minStock: newMinStock,\n          warehouseId: selectedWarehouse?.id,/' src/components/WarehouseTab.tsx

# 5. Update handleStockAction body to include warehouseId
sed -i 's/note: txNote.trim(),/note: txNote.trim(),\n          warehouseId: selectedWarehouse?.id,/' src/components/WarehouseTab.tsx

# 6. Update import API call to include warehouseId
sed -i 's/body: JSON.stringify({ items: mappedItems }),/body: JSON.stringify({ items: mappedItems, warehouseId: selectedWarehouse?.id }),/' src/components/WarehouseTab.tsx

