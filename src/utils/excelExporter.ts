import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Invoice, PurchaseOrder, formatVND } from '../types';

// Helper function to convert a number to Vietnamese words
export function convertNumberToVietnameseWords(amount: number): string {
  if (amount === 0) return "Không đồng chẵn./.";
  
  const t = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  
  const r = (r2: number, n: boolean): string => {
    let o2 = "", a2 = Math.floor(r2 / 100), e2 = r2 % 100;
    if (n || a2 > 0) { 
      o2 += " " + t[a2] + " trăm"; 
      o2 += e2 === 0 ? "" : (e2 < 10 ? " lẻ" : ""); 
    }
    let i2 = Math.floor(e2 / 10), m2 = e2 % 10;
    if (i2 > 0) { 
      o2 += i2 === 1 ? " mười" : " " + t[i2] + " mươi"; 
    }
    if (m2 > 0) {
      if (m2 === 1 && i2 > 1) o2 += " mốt";
      else if (m2 === 5 && i2 > 0) o2 += " lăm";
      else o2 += " " + t[m2];
    }
    return o2;
  };

  let isNegative = amount < 0;
  let o2 = "", e2 = 0, num = Math.abs(amount);
  do {
    let ty = num % 1e9;
    num = Math.floor(num / 1e9);
    let i2 = ty > 0 ? ((num2: number, e3: boolean) => {
      let resO = "", a3 = Math.floor(num2 / 1e6), n2 = num2 % 1e6;
      if (a3 > 0) { resO += r(a3, e3) + " triệu"; e3 = true; }
      let idx2 = Math.floor(n2 / 1e3), m3 = n2 % 1e3;
      if (idx2 > 0) { resO += r(idx2, e3) + " nghìn"; e3 = true; }
      if (m3 > 0) resO += r(m3, e3);
      return resO;
    })(ty, num > 0) : "";
    if (i2) o2 = i2 + (e2 > 0 ? " tỷ".repeat(e2) : "") + o2;
    e2++;
  } while (num > 0);

  let res = o2.trim();
  if (res.startsWith("lẻ ")) res = res.substring(3);
  if (isNegative) res = "âm " + res;
  res = res.charAt(0).toUpperCase() + res.slice(1);
  return res + " đồng chẵn./.";
}

// Check if document is a purchase order or a sales invoice
function isPurchaseOrder(doc: Invoice | PurchaseOrder): doc is PurchaseOrder {
  return 'poNumber' in doc;
}

export async function exportDocumentToExcel(doc: Invoice | PurchaseOrder, printType: 'standard' | 'vat' | 'delivery') {
  const isPO = isPurchaseOrder(doc);
  
  // Extract common fields
  const documentCode = doc.documentCode;
  const partnerName = isPO ? (doc.supplierName || '') : (doc.customerName || '');
  const partnerAddress = isPO ? (doc.supplierAddress || '') : (doc.customerAddress || '');
  const partnerPhone = isPO ? (doc.supplierPhone || '') : (doc.customerPhone || '');
  const partnerTaxId = isPO ? (doc.supplierTaxId || '') : (doc.customerTaxId || '');
  const createdAtStr = doc.createdAt;
  const createdDate = createdAtStr ? new Date(createdAtStr) : new Date();
  
  const dd = String(createdDate.getDate()).padStart(2, '0');
  const mm = String(createdDate.getMonth() + 1).padStart(2, '0');
  const yyyy = createdDate.getFullYear();
  
  const items = doc.items || [];
  const deposits = doc.deposits || [];
  const depositEnabled = doc.depositEnabled;
  
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(
    printType === 'delivery' ? 'Biên Bản Giao Hàng' : (printType === 'vat' ? 'Phiếu Chi Tiết VAT' : 'Phiếu Tiêu Chuẩn')
  );

  // Common border style
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  const boldFont: Partial<ExcelJS.Font> = { name: 'Times New Roman', bold: true, size: 12 };
  const normalFont: Partial<ExcelJS.Font> = { name: 'Times New Roman', size: 12 };
  const headerFont: Partial<ExcelJS.Font> = { name: 'Times New Roman', bold: true, size: 18 };
  
  const applyCellStyles = (cell: ExcelJS.Cell, font: Partial<ExcelJS.Font>, alignment: Partial<ExcelJS.Alignment> = {}) => {
    cell.font = font;
    cell.alignment = { vertical: 'middle', ...alignment };
  };

  if (printType === 'delivery') {
    // ----------------------------------------------------
    // BIÊN BẢN BÀN GIAO LAYOUT (5 Columns: A to E)
    // ----------------------------------------------------
    ws.columns = [
      { width: 8 },  // STT
      { width: 45 }, // Tên hàng
      { width: 15 }, // Đơn vị tính
      { width: 12 }, // Số lượng
      { width: 20 }  // Chất lượng
    ];

    ws.mergeCells('A1:E1');
    applyCellStyles(ws.getCell('A1'), boldFont, { horizontal: 'center' });
    ws.getCell('A1').value = "CÔNG TY TRÁCH NHIỆM HỮU HẠN DỊCH VỤ VIỄN THÔNG ĐỨC VINH";

    ws.mergeCells('A2:E2');
    applyCellStyles(ws.getCell('A2'), normalFont, { horizontal: 'center' });
    ws.getCell('A2').value = "137 Đường Thới Tam Thôn 9, Xã Đông Thạnh, Thành phố Hồ Chí Minh, Việt Nam.";

    ws.mergeCells('A4:E4');
    applyCellStyles(ws.getCell('A4'), headerFont, { horizontal: 'center' });
    ws.getCell('A4').value = "BIÊN BẢN BÀN GIAO";

    ws.mergeCells('A5:E5');
    applyCellStyles(ws.getCell('A5'), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell('A5').value = `Ngày ${dd} tháng ${mm} năm ${yyyy} tại`;

    ws.mergeCells('A7:E7');
    applyCellStyles(ws.getCell('A7'), boldFont, { horizontal: 'left' });
    ws.getCell('A7').value = `Đại diện bên nhận (Bên A): ${partnerName.toUpperCase()}`;

    ws.mergeCells('A8:C8');
    applyCellStyles(ws.getCell('A8'), normalFont, { horizontal: 'left' });
    ws.getCell('A8').value = "Ông (Bà): ....................................................";
    ws.mergeCells('D8:E8');
    applyCellStyles(ws.getCell('D8'), normalFont, { horizontal: 'left' });
    ws.getCell('D8').value = "Chức vụ: ....................................................";

    ws.mergeCells('A9:E9');
    applyCellStyles(ws.getCell('A9'), boldFont, { horizontal: 'left' });
    ws.getCell('A9').value = "Đại diện bên giao (Bên B): CÔNG TY TRÁCH NHIỆM HỮU HẠN DỊCH VỤ VIỄN THÔNG ĐỨC VINH";

    ws.mergeCells('A10:C10');
    applyCellStyles(ws.getCell('A10'), normalFont, { horizontal: 'left' });
    ws.getCell('A10').value = "Ông (Bà): ....................................................";
    ws.mergeCells('D10:E10');
    applyCellStyles(ws.getCell('D10'), normalFont, { horizontal: 'left' });
    ws.getCell('D10').value = "Chức vụ: ....................................................";

    ws.mergeCells('A11:E11');
    applyCellStyles(ws.getCell('A11'), { ...normalFont, italic: true }, { horizontal: 'left' });
    ws.getCell('A11').value = `Ngày ${dd} tháng ${mm} năm ${yyyy} tại`;

    ws.mergeCells('A12:E12');
    applyCellStyles(ws.getCell('A12'), normalFont, { horizontal: 'left' });
    ws.getCell('A12').value = "Hai bên cùng nhau bàn giao hàng hoá chi tiết như sau:";

    // Table Header
    const headerRow = ws.getRow(14);
    headerRow.values = ["STT", "Tên hàng", "Đơn vị tính", "Số lượng", "Chất lượng"];
    headerRow.eachCell((cell) => {
      applyCellStyles(cell, boldFont, { horizontal: 'center' });
      cell.border = thinBorder;
    });

    let currentRowIdx = 15;
    items.forEach((item, idx) => {
      const row = ws.getRow(currentRowIdx);
      row.values = [idx + 1, item.productName, item.unit || "Cái", item.quantity, "Tốt"];
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'left' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.eachCell((cell) => {
        cell.font = normalFont;
        cell.border = thinBorder;
      });
      currentRowIdx++;
    });

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:E${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), normalFont, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "Về chất lượng hàng hóa và phụ kiện: Hàng hoá được cung cấp mới 100%.";
    
    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:E${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), normalFont, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "Biên bản này được lập thành 02 (hai) bản có giá trị như nhau, mỗi bên giữ 01 (một) bản để cùng thực hiện.";

    currentRowIdx += 3;
    ws.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), boldFont, { horizontal: 'center' });
    ws.getCell(`A${currentRowIdx}`).value = "ĐẠI DIỆN BÊN NHẬN";

    ws.mergeCells(`D${currentRowIdx}:E${currentRowIdx}`);
    applyCellStyles(ws.getCell(`D${currentRowIdx}`), boldFont, { horizontal: 'center' });
    ws.getCell(`D${currentRowIdx}`).value = "ĐẠI DIỆN BÊN GIAO";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell(`A${currentRowIdx}`).value = "(Ký, họ tên)";

    ws.mergeCells(`D${currentRowIdx}:E${currentRowIdx}`);
    applyCellStyles(ws.getCell(`D${currentRowIdx}`), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell(`D${currentRowIdx}`).value = "(Ký, họ tên)";

  } else if (printType === 'standard') {
    // ----------------------------------------------------
    // PHIẾU TIÊU CHUẨN (7 Columns: A to G)
    // ----------------------------------------------------
    ws.columns = [
      { width: 8 },  // STT
      { width: 15 }, // Mã sản phẩm
      { width: 45 }, // Tên thiết bị
      { width: 12 }, // Đơn vị
      { width: 12 }, // Số lượng
      { width: 18 }, // Đơn giá
      { width: 22 }  // Thành tiền
    ];

    ws.mergeCells('A1:G1');
    applyCellStyles(ws.getCell('A1'), boldFont, { horizontal: 'left' });
    ws.getCell('A1').value = "CÔNG TY TNHH DỊCH VỤ VIỄN THÔNG ĐỨC VINH";

    ws.mergeCells('A2:G2');
    applyCellStyles(ws.getCell('A2'), normalFont, { horizontal: 'left' });
    ws.getCell('A2').value = "Địa chỉ: 137 Đường Thới Tam Thôn 9, Xã Thới Tam Thôn, Huyện Hóc Môn, TP.Hồ Chí Minh";

    ws.mergeCells('A3:G3');
    applyCellStyles(ws.getCell('A3'), normalFont, { horizontal: 'left' });
    ws.getCell('A3').value = "MST: 0311193770";

    ws.mergeCells('A4:G4');
    applyCellStyles(ws.getCell('A4'), normalFont, { horizontal: 'left' });
    ws.getCell('A4').value = "Hotline: 0938288876-0915877739.  FB: DUCVINHSOLAR-Website: Ducvinhsolar.com";

    ws.mergeCells('A6:G6');
    applyCellStyles(ws.getCell('A6'), headerFont, { horizontal: 'center' });
    ws.getCell('A6').value = "BẢNG BÁO GIÁ";

    ws.mergeCells('A7:G7');
    applyCellStyles(ws.getCell('A7'), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell('A7').value = `Ngày ${dd} tháng ${mm} năm ${yyyy}`;

    ws.mergeCells('A8:G8');
    applyCellStyles(ws.getCell('A8'), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell('A8').value = `Số: ${documentCode}`;

    ws.mergeCells('A10:G10');
    applyCellStyles(ws.getCell('A10'), boldFont, { horizontal: 'left' });
    ws.getCell('A10').value = `Tên khách hàng: ${partnerName || "...................................................."}`;

    ws.mergeCells('A11:G11');
    applyCellStyles(ws.getCell('A11'), normalFont, { horizontal: 'left' });
    ws.getCell('A11').value = `Địa chỉ: ${partnerAddress || "...................................................."}`;

    ws.mergeCells('A12:G12');
    applyCellStyles(ws.getCell('A12'), normalFont, { horizontal: 'left' });
    ws.getCell('A12').value = `Số điện thoại: ${partnerPhone || "...................................................."}`;

    ws.mergeCells('A13:G13');
    applyCellStyles(ws.getCell('A13'), normalFont, { horizontal: 'left' });
    ws.getCell('A13').value = `Mã số thuế: ${partnerTaxId || "...................................................."}`;

    // Table Header
    const headerRow = ws.getRow(15);
    headerRow.values = ["STT", "Mã sản phẩm", "Tên thiết bị", "Đơn vị", "Số lượng", "Đơn giá", "Thành tiền"];
    headerRow.eachCell((cell) => {
      applyCellStyles(cell, boldFont, { horizontal: 'center' });
      cell.border = thinBorder;
    });

    let currentRowIdx = 16;
    let totalSum = 0;
    
    items.forEach((item, idx) => {
      const lineTotal = item.quantity * item.price;
      totalSum += lineTotal;
      const row = ws.getRow(currentRowIdx);
      row.values = [idx + 1, item.productCode || "", item.productName, item.unit || "Cái", item.quantity, item.price, lineTotal];
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'left' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).alignment = { horizontal: 'right' };
      row.getCell(7).numFmt = '#,##0';
      row.eachCell((cell) => {
        cell.font = normalFont;
        cell.border = thinBorder;
      });
      currentRowIdx++;
    });

    // Subtotal Row
    const subtotalRow = ws.getRow(currentRowIdx);
    subtotalRow.getCell(1).value = "II";
    ws.mergeCells(`B${currentRowIdx}:F${currentRowIdx}`);
    subtotalRow.getCell(2).value = "TỔNG CỘNG";
    subtotalRow.getCell(7).value = totalSum;
    subtotalRow.getCell(7).numFmt = '#,##0';
    
    subtotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 7) {
        applyCellStyles(cell, boldFont, colNumber === 1 ? { horizontal: 'center' } : (colNumber === 2 ? { horizontal: 'left' } : { horizontal: 'right' }));
        cell.border = thinBorder;
      }
    });
    currentRowIdx++;
    
    let activeTotal = totalSum;
    
    // Deposit Rows
    if (depositEnabled && deposits && deposits.length > 0) {
      deposits.forEach((dep, depIdx) => {
        const depNote = dep.note || `Khách thanh toán lần thứ ${depIdx + 1}`;
        const row = ws.getRow(currentRowIdx);
        row.getCell(1).value = "-";
        ws.mergeCells(`B${currentRowIdx}:F${currentRowIdx}`);
        row.getCell(2).value = depNote;
        row.getCell(7).value = -dep.amount;
        row.getCell(7).numFmt = '#,##0';
        
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= 7) {
            applyCellStyles(cell, boldFont, colNumber === 1 ? { horizontal: 'center' } : (colNumber === 2 ? { horizontal: 'left' } : { horizontal: 'right' }));
            cell.border = thinBorder;
          }
        });
        activeTotal -= dep.amount;
        currentRowIdx++;
      });
      
      const remainingRow = ws.getRow(currentRowIdx);
      remainingRow.getCell(1).value = "III";
      ws.mergeCells(`B${currentRowIdx}:F${currentRowIdx}`);
      remainingRow.getCell(2).value = "CÒN LẠI CẦN THANH TOÁN";
      remainingRow.getCell(7).value = activeTotal;
      remainingRow.getCell(7).numFmt = '#,##0';
      
      remainingRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= 7) {
          applyCellStyles(cell, boldFont, colNumber === 1 ? { horizontal: 'center' } : (colNumber === 2 ? { horizontal: 'left' } : { horizontal: 'right' }));
          cell.border = thinBorder;
        }
      });
      currentRowIdx++;
    }

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), { ...normalFont, italic: true }, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = `Bằng chữ: ${convertNumberToVietnameseWords(activeTotal)}`;

    currentRowIdx += 2;
    ws.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), { ...normalFont, bold: true, color: { argb: 'FFFF0000' } }, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "Thanh toán 100% trước khi xuất hàng xuất tại kho .";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), boldFont, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "TK THANH TOÁN:";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), normalFont, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "1. CÔNG TY: Tên TK: Công Ty TNHH DV VIỄN THÔNG ĐỨC VINH";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), normalFont, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "Tài khoản số : 661000068 - Ngân hàng ACB – CN Phú Lâm, Tp.HCM";

    currentRowIdx += 3;
    ws.mergeCells(`A${currentRowIdx}:C${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), boldFont, { horizontal: 'center' });
    ws.getCell(`A${currentRowIdx}`).value = "XÁC NHẬN CỦA KHÁCH HÀNG (ĐỐI TÁC)";

    ws.mergeCells(`E${currentRowIdx}:G${currentRowIdx}`);
    applyCellStyles(ws.getCell(`E${currentRowIdx}`), boldFont, { horizontal: 'center' });
    ws.getCell(`E${currentRowIdx}`).value = "ĐẠI DIỆN CÔNG TY";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:C${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell(`A${currentRowIdx}`).value = "(Ký, họ tên)";

    ws.mergeCells(`E${currentRowIdx}:G${currentRowIdx}`);
    applyCellStyles(ws.getCell(`E${currentRowIdx}`), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell(`E${currentRowIdx}`).value = "(Ký, họ tên)";

  } else if (printType === 'vat') {
    // ----------------------------------------------------
    // PHIẾU CHI TIẾT VAT (9 Columns: A to I)
    // ----------------------------------------------------
    ws.columns = [
      { width: 8 },  // STT
      { width: 15 }, // Mã sản phẩm
      { width: 45 }, // Tên thiết bị
      { width: 10 }, // Đơn vị
      { width: 10 }, // Số lượng
      { width: 15 }, // Đơn giá pre-VAT
      { width: 10 }, // VAT %
      { width: 15 }, // Trước VAT Total
      { width: 18 }  // Thành tiền (sau VAT)
    ];

    ws.mergeCells('A1:I1');
    applyCellStyles(ws.getCell('A1'), boldFont, { horizontal: 'left' });
    ws.getCell('A1').value = "CÔNG TY TNHH DỊCH VỤ VIỄN THÔNG ĐỨC VINH";

    ws.mergeCells('A2:I2');
    applyCellStyles(ws.getCell('A2'), normalFont, { horizontal: 'left' });
    ws.getCell('A2').value = "Địa chỉ: 137 Đường Thới Tam Thôn 9, Xã Thới Tam Thôn, Huyện Hóc Môn, TP.Hồ Chí Minh";

    ws.mergeCells('A3:I3');
    applyCellStyles(ws.getCell('A3'), normalFont, { horizontal: 'left' });
    ws.getCell('A3').value = "MST: 0311193770";

    ws.mergeCells('A4:I4');
    applyCellStyles(ws.getCell('A4'), normalFont, { horizontal: 'left' });
    ws.getCell('A4').value = "Hotline: 0938288876-0915877739.  FB: DUCVINHSOLAR-Website: Ducvinhsolar.com";

    ws.mergeCells('A6:I6');
    applyCellStyles(ws.getCell('A6'), headerFont, { horizontal: 'center' });
    ws.getCell('A6').value = "BẢNG BÁO GIÁ (CHI TIẾT VAT)";

    ws.mergeCells('A7:I7');
    applyCellStyles(ws.getCell('A7'), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell('A7').value = `Ngày ${dd} tháng ${mm} năm ${yyyy}`;

    ws.mergeCells('A8:I8');
    applyCellStyles(ws.getCell('A8'), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell('A8').value = `Số: ${documentCode}`;

    ws.mergeCells('A10:I10');
    applyCellStyles(ws.getCell('A10'), boldFont, { horizontal: 'left' });
    ws.getCell('A10').value = `Tên khách hàng: ${partnerName || "...................................................."}`;

    ws.mergeCells('A11:I11');
    applyCellStyles(ws.getCell('A11'), normalFont, { horizontal: 'left' });
    ws.getCell('A11').value = `Địa chỉ: ${partnerAddress || "...................................................."}`;

    ws.mergeCells('A12:I12');
    applyCellStyles(ws.getCell('A12'), normalFont, { horizontal: 'left' });
    ws.getCell('A12').value = `Số điện thoại: ${partnerPhone || "...................................................."}`;

    ws.mergeCells('A13:I13');
    applyCellStyles(ws.getCell('A13'), normalFont, { horizontal: 'left' });
    ws.getCell('A13').value = `Mã số thuế: ${partnerTaxId || "...................................................."}`;

    // Table Header
    const headerRow = ws.getRow(15);
    headerRow.values = ["STT", "Mã sản phẩm", "Tên thiết bị", "Đơn vị", "Số lượng", "Đơn giá", "VAT", "Trước VAT", "Thành tiền"];
    headerRow.eachCell((cell) => {
      applyCellStyles(cell, boldFont, { horizontal: 'center' });
      cell.border = thinBorder;
    });

    let currentRowIdx = 16;
    let totalPreVat = 0;
    let totalVat = 0;
    let totalSum = 0;
    
    items.forEach((item, idx) => {
      const lineTotal = item.quantity * item.price;
      const vatRate = item.hasVat ? (item.vatRate || 10) : 0;
      const donGiaPreVat = item.hasVat ? (item.price / (1 + vatRate / 100)) : item.price;
      const truocVat = donGiaPreVat * item.quantity;
      const lineVat = lineTotal - truocVat;
      
      totalPreVat += truocVat;
      totalVat += lineVat;
      totalSum += lineTotal;
      
      const row = ws.getRow(currentRowIdx);
      row.values = [
        idx + 1,
        item.productCode || "",
        item.productName,
        item.unit || "Cái",
        item.quantity,
        donGiaPreVat,
        item.hasVat ? `${vatRate}%` : "0%",
        truocVat,
        lineTotal
      ];
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'left' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'right' };
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(9).numFmt = '#,##0';
      row.eachCell((cell) => {
        cell.font = normalFont;
        cell.border = thinBorder;
      });
      currentRowIdx++;
    });

    const addSummaryRow = (label1: string, label2: string, value: number, isCurrency: boolean = true) => {
      const row = ws.getRow(currentRowIdx);
      row.getCell(1).value = label1;
      ws.mergeCells(`B${currentRowIdx}:H${currentRowIdx}`);
      row.getCell(2).value = label2;
      row.getCell(9).value = value;
      if (isCurrency) row.getCell(9).numFmt = '#,##0';
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= 9) {
          applyCellStyles(cell, boldFont, colNumber === 1 ? { horizontal: 'center' } : (colNumber === 2 ? { horizontal: 'left' } : { horizontal: 'right' }));
          cell.border = thinBorder;
        }
      });
      currentRowIdx++;
    };

    addSummaryRow("II", "TỔNG CỘNG TIỀN HÀNG (TRƯỚC VAT)", totalPreVat);
    addSummaryRow("III", "TỔNG TIỀN THUẾ GTGT (VAT)", totalVat);
    addSummaryRow("IV", "TỔNG CỘNG TIỀN THANH TOÁN", totalSum);
    
    let activeTotal = totalSum;
    
    if (depositEnabled && deposits && deposits.length > 0) {
      deposits.forEach((dep, depIdx) => {
        const depNote = dep.note || `Khách thanh toán lần thứ ${depIdx + 1}`;
        addSummaryRow("-", depNote, -dep.amount);
        activeTotal -= dep.amount;
      });
      
      addSummaryRow("V", "CÒN LẠI CẦN THANH TOÁN", activeTotal);
    }

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), { ...normalFont, italic: true }, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = `Bằng chữ: ${convertNumberToVietnameseWords(activeTotal)}`;

    currentRowIdx += 2;
    ws.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), { ...normalFont, bold: true, color: { argb: 'FFFF0000' } }, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "Thanh toán 100% trước khi xuất hàng xuất tại kho .";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), boldFont, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "TK THANH TOÁN:";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), normalFont, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "1. CÔNG TY: Tên TK: Công Ty TNHH DV VIỄN THÔNG ĐỨC VINH";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), normalFont, { horizontal: 'left' });
    ws.getCell(`A${currentRowIdx}`).value = "Tài khoản số : 661000068 - Ngân hàng ACB – CN Phú Lâm, Tp.HCM";

    currentRowIdx += 3;
    ws.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), boldFont, { horizontal: 'center' });
    ws.getCell(`A${currentRowIdx}`).value = "XÁC NHẬN CỦA KHÁCH HÀNG (ĐỐI TÁC)";

    ws.mergeCells(`G${currentRowIdx}:I${currentRowIdx}`);
    applyCellStyles(ws.getCell(`G${currentRowIdx}`), boldFont, { horizontal: 'center' });
    ws.getCell(`G${currentRowIdx}`).value = "ĐẠI DIỆN CÔNG TY";

    currentRowIdx++;
    ws.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
    applyCellStyles(ws.getCell(`A${currentRowIdx}`), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell(`A${currentRowIdx}`).value = "(Ký, họ tên)";

    ws.mergeCells(`G${currentRowIdx}:I${currentRowIdx}`);
    applyCellStyles(ws.getCell(`G${currentRowIdx}`), { ...normalFont, italic: true }, { horizontal: 'center' });
    ws.getCell(`G${currentRowIdx}`).value = "(Ký, họ tên)";
  }
  
  // Save/Download Excel file
  const filePrefix = isPO ? "Phieu_Nhap_" : "Hoa_Don_";
  const typeSuffix = printType === 'delivery' ? "Bien_Ban_Ban_Giao" : (printType === 'vat' ? "Chi_Tiet_VAT" : "Tieu_Chuan");
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filePrefix}${documentCode}_${typeSuffix}.xlsx`);
}

