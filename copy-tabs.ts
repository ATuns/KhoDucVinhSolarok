import fs from 'fs';

// Copy PendingTab
let pending = fs.readFileSync('src/components/PendingTab.tsx', 'utf8');
pending = pending.replace(/PendingTab/g, 'PurchasePendingTab')
  .replace(/Customer/g, 'Supplier')
  .replace(/customer/g, 'supplier')
  .replace(/Khách hàng/g, 'Nhà cung cấp')
  .replace(/khách hàng/g, 'nhà cung cấp')
  .replace(/invoices/g, 'purchase-orders')
  .replace(/Invoice/g, 'PurchaseOrder')
  .replace(/invoice/g, 'purchaseOrder')
  .replace(/Sổ Hóa Đơn/g, 'Sổ Phiếu Nhập')
  .replace(/sổ hóa đơn/g, 'sổ phiếu nhập')
  .replace(/Hóa đơn/g, 'Phiếu nhập')
  .replace(/hóa đơn/g, 'phiếu nhập');
fs.writeFileSync('src/components/PurchasePendingTab.tsx', pending);

// Copy InvoicesTab
let invoices = fs.readFileSync('src/components/InvoicesTab.tsx', 'utf8');
invoices = invoices.replace(/InvoicesTab/g, 'PurchaseInvoicesTab')
  .replace(/Customer/g, 'Supplier')
  .replace(/customer/g, 'supplier')
  .replace(/Khách hàng/g, 'Nhà cung cấp')
  .replace(/khách hàng/g, 'nhà cung cấp')
  .replace(/invoices/g, 'purchase-orders')
  .replace(/Invoice/g, 'PurchaseOrder')
  .replace(/invoice/g, 'purchaseOrder')
  .replace(/Sổ Hóa Đơn/g, 'Sổ Phiếu Nhập')
  .replace(/sổ hóa đơn/g, 'sổ phiếu nhập')
  .replace(/Hóa đơn/g, 'Phiếu nhập')
  .replace(/hóa đơn/g, 'phiếu nhập')
  .replace(/Bán hàng/g, 'Nhập hàng');
fs.writeFileSync('src/components/PurchaseInvoicesTab.tsx', invoices);

// Also replace some more UI text in both if needed
