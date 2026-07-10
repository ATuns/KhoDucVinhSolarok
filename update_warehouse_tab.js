const fs = require('fs');
const content = fs.readFileSync('src/components/WarehouseTab.tsx', 'utf-8');

const exportHistoryFunc = `
  const handleExportHistoryToExcel = () => {
    if (!historyProduct || txHistory.length === 0) return;

    const exportData = txHistory.map((tx) => {
      const isImport = tx.type === 'NHAP' || tx.type === 'BO_GHI_SO';
      const isExport = tx.type === 'XUAT' || tx.type === 'GHI_SO';
      const importQty = isImport ? tx.quantity : 0;
      const exportQty = isExport ? tx.quantity : 0;
      const unitPrice = tx.unitPrice || historyProduct.price;
      const importVal = importQty * unitPrice;
      const exportVal = exportQty * unitPrice;
      const balanceQty = tx.runningBalance || 0;
      const balanceVal = balanceQty * unitPrice;

      let typeText = "Không xác định";
      if (tx.type === 'NHAP') typeText = "Nhập Kho";
      else if (tx.type === 'XUAT') typeText = "Xuất Kho (Tạm)";
      else if (tx.type === 'GHI_SO') typeText = "Xuất Kho (Bán hàng)";
      else if (tx.type === 'BO_GHI_SO') typeText = "Hủy Xuất Kho";

      return {
        "Thời gian": tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : '',
        "Chứng từ": tx.docNumber || "-",
        "Đối tác/Diễn giải": tx.partnerName || (tx.type === 'NHAP' ? 'Nhập kho thủ công' : tx.type === 'XUAT' ? 'Xuất kho thủ công' : tx.note || ''),
        "Loại giao dịch": typeText,
        "Đơn vị tính": historyProduct.category.toLowerCase().includes('pin') ? 'Tấm' : 'Bộ/Cái',
        "Đơn giá": unitPrice,
        "Số lượng Nhập": importQty,
        "Giá trị Nhập": importVal,
        "Số lượng Xuất": exportQty,
        "Giá trị Xuất": exportVal,
        "Số lượng Tồn": balanceQty,
        "Giá trị Tồn": balanceVal,
        "Nhân viên thực hiện": tx.userEmail
      };
    });

    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Lịch Sử Giao Dịch Kho");
    xlsx.writeFile(wb, \`Lich_Su_Kho_\${historyProduct.code}.xlsx\`);
  };
`;

const updatedContent = content.replace(
  "const viewStockHistory = async (product: Product) => {",
  exportHistoryFunc + "\n  const viewStockHistory = async (product: Product) => {"
);

fs.writeFileSync('src/components/WarehouseTab.tsx', updatedContent);
