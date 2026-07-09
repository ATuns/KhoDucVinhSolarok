import fs from 'fs';
let content = fs.readFileSync('src/components/SalesTab.tsx', 'utf8');
content = content.replace(/SalesTab/g, 'PurchaseTab')
  .replace(/Customer/g, 'Supplier')
  .replace(/customer/g, 'supplier')
  .replace(/Khách hàng/g, 'Nhà cung cấp')
  .replace(/khách hàng/g, 'nhà cung cấp')
  .replace(/Bán Hàng/g, 'Nhập Hàng')
  .replace(/bán hàng/g, 'nhập hàng')
  .replace(/Bán hàng/g, 'Nhập hàng')
  .replace(/invoices/g, 'purchase-orders')
  .replace(/Invoice/g, 'PurchaseOrder')
  .replace(/invoice/g, 'purchaseOrder'); // camelCase
fs.writeFileSync('src/components/PurchaseTab.tsx', content);
