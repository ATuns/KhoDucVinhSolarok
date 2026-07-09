#!/bin/bash
sed -i 's/import { Product, Customer/import { Product, Customer, Warehouse/' src/components/SalesTab.tsx

sed -i '/const \[productsCache, setProductsCache\] = useState<Product\[\]>(/a \
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);\
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);' src/components/SalesTab.tsx

sed -i '/vatRate\?: number;/a \
    warehouseId?: number;' src/components/SalesTab.tsx

sed -i '/loadCustomers();/a \
    const loadWarehouses = async () => {\
      try {\
        const res = await fetchWithAuth("/api/warehouses");\
        if (res.ok) {\
          const data = await res.json();\
          setWarehouses(data);\
          if (data.length > 0) setSelectedWarehouseId(data[0].id);\
        }\
      } catch (err) {\
        console.error(err);\
      }\
    };\
    loadWarehouses();' src/components/SalesTab.tsx

