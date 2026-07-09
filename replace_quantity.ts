import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const target = `      if (lowStock === "true") conditions.push(sql\`\${products.quantity} <= \${products.minStock}\`);
      if (inStock === "true") conditions.push(sql\`\${products.quantity} > 0\`);

      const query = db.select({
        id: products.id,
        code: products.code,
        name: products.name,
        category: products.category,
        unit: products.unit,
        quantity: products.quantity,
        price: products.price,
        minStock: products.minStock,
        isHidden: products.isHidden,
        warehouseId: products.warehouseId,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name
      }).from(products)
      .leftJoin(warehouses, eq(products.warehouseId, warehouses.id));`;

const replacement = `      const dynamicQuantityQuery = sql<number>\`
        COALESCE(
          (
            SELECT SUM(
              CASE 
                WHEN type IN ('NHAP', 'BO_GHI_SO') THEN quantity
                WHEN type IN ('XUAT', 'GHI_SO') THEN -quantity
                ELSE 0 
              END
            )
            FROM stock_transactions st
            WHERE st.product_id = products.id
          ), 0
        )
      \`.mapWith(Number);

      if (lowStock === "true") conditions.push(sql\`\${dynamicQuantityQuery} <= \${products.minStock}\`);
      if (inStock === "true") conditions.push(sql\`\${dynamicQuantityQuery} > 0\`);

      const query = db.select({
        id: products.id,
        code: products.code,
        name: products.name,
        category: products.category,
        unit: products.unit,
        quantity: dynamicQuantityQuery,
        price: products.price,
        minStock: products.minStock,
        isHidden: products.isHidden,
        warehouseId: products.warehouseId,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name
      }).from(products)
      .leftJoin(warehouses, eq(products.warehouseId, warehouses.id));`;

if (content.includes(target)) {
  fs.writeFileSync('server.ts', content.replace(target, replacement));
  console.log('Replaced successfully');
} else {
  console.log('Target not found');
}
