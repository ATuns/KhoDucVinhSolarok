import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Product, StockTransaction, Warehouse, formatVND, formatQuantity } from '../types.ts';
import { PriceInput } from './PriceInput.tsx';
import { QuantityInput } from './QuantityInput.tsx';
import { 
  Plus, Search, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  FileSpreadsheet, SlidersHorizontal, RefreshCw, Layers, CheckCircle2,
  Edit2, Download
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { WarehouseManager } from "./WarehouseManager.tsx";
import { ChevronLeft } from "lucide-react";

const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

export const WarehouseTab: React.FC = () => {
  const { fetchWithAuth } = useAuth();
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterInStock, setFilterInStock] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Form states for Add Product
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newPrice, setNewPrice] = useState(0);
  const [newQuantity, setNewQuantity] = useState(0);
  const [newMinStock, setNewMinStock] = useState(10);

  // Form states for Stock Transaction
  const [showTxModal, setShowTxModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [txType, setTxType] = useState<'NHAP' | 'XUAT'>('NHAP');
  const [txQty, setTxQty] = useState(1);
  const [txNote, setTxNote] = useState('');

  // History state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [txHistory, setTxHistory] = useState<StockTransaction[]>([]);
  const [historyEndBalance, setHistoryEndBalance] = useState(0);
  const [historyStartBalance, setHistoryStartBalance] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historySortOrder, setHistorySortOrder] = useState<'desc' | 'asc'>('desc');

  const sortedTxHistory = React.useMemo(() => {
    let result = [...txHistory];
    
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      
      // If dates are exactly the same, fallback to ID to maintain stable sort
      if (dateA === dateB) {
        if (historySortOrder === 'desc') {
          return b.id - a.id;
        } else {
          return a.id - b.id;
        }
      }

      if (historySortOrder === 'desc') {
        return dateB - dateA; // Newest first
      } else {
        return dateA - dateB; // Oldest first
      }
    });

    return result;
  }, [txHistory, historySortOrder]);

  const historyTotals = React.useMemo(() => {
    let totalImportQty = 0;
    let totalImportVal = 0;
    let totalExportQty = 0;
    let totalExportVal = 0;
    
    txHistory.forEach(tx => {
      const isImport = tx.type === 'NHAP' || tx.type === 'BO_GHI_SO';
      const isExport = tx.type === 'XUAT' || tx.type === 'GHI_SO';
      const unitPrice = tx.unitPrice || historyProduct?.price || 0;
      
      if (isImport) {
        totalImportQty += tx.quantity;
        totalImportVal += tx.quantity * unitPrice;
      }
      if (isExport) {
        totalExportQty += tx.quantity;
        totalExportVal += tx.quantity * unitPrice;
      }
    });

    const unitPrice = historyProduct?.price || 0;
    const finalBalanceQty = historyEndBalance;
    const finalBalanceVal = finalBalanceQty * unitPrice;

    return {
      totalImportQty,
      totalImportVal,
      totalExportQty,
      totalExportVal,
      finalBalanceQty,
      finalBalanceVal
    };
  }, [txHistory, historyProduct, historyEndBalance]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLowStock) params.append('lowStock', 'true');
      if (filterInStock) params.append('inStock', 'true');
      if (selectedWarehouse) params.append('warehouseId', selectedWarehouse.id.toString());

      const res = await fetchWithAuth(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error("Không thể tải danh sách vật tư");
      const data = await res.json();
      setProductsList(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchProducts();
  }, [filterLowStock, filterInStock, selectedWarehouse]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleEditClick = (product: Product) => {
    setEditProductId(product.id);
    setNewCode(product.code);
    setNewName(product.name);
    setNewCategory(product.category);
    setNewUnit(product.unit || '');
    setNewPrice(product.price);
    setNewQuantity(product.quantity);
    setNewMinStock(product.minStock);
    setShowAddModal(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const url = editProductId ? `/api/products/${editProductId}` : '/api/products';
      const method = editProductId ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          code: newCode.trim(),
          name: newName.trim(),
          category: newCategory.trim(),
          unit: newUnit.trim(),
          price: newPrice,
          quantity: newQuantity,
          minStock: newMinStock,
          warehouseId: selectedWarehouse?.id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Lỗi ${editProductId ? 'cập nhật' : 'tạo'} sản phẩm`);
      }

      setSuccessMsg(`${editProductId ? 'Cập nhật' : 'Thêm mới'} sản phẩm thành công!`);
      setShowAddModal(false);
      // Reset form
      setEditProductId(null);
      setNewCode('');
      setNewName('');
      setNewCategory('');
      setNewPrice(0);
      setNewQuantity(0);
      setNewMinStock(10);
      fetchProducts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetchWithAuth('/api/products/stock-transaction', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.id,
          type: txType,
          quantity: txQty,
          note: txNote.trim(),
          warehouseId: selectedWarehouse?.id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Lỗi thực hiện giao dịch kho");
      }

      setSuccessMsg(`${txType === 'NHAP' ? 'Nhập kho' : 'Xuất kho'} thành công sản phẩm: ${selectedProduct.name}`);
      setShowTxModal(false);
      setTxQty(1);
      setTxNote('');
      fetchProducts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchHistory = async (product: Product, start?: string, end?: string) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (start) params.append('startDate', start);
      if (end) params.append('endDate', end);
      const res = await fetchWithAuth(`/api/products/${product.id}/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTxHistory(data);
          setHistoryEndBalance(data.length > 0 ? (data[0].runningBalance || 0) : 0);
          setHistoryStartBalance(0);
        } else {
          setTxHistory(data.transactions || []);
          setHistoryEndBalance(data.endBalance || 0);
          setHistoryStartBalance(data.startBalance || 0);
        }
        setHistoryPage(1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const viewStockHistory = async (product: Product) => {
    setHistoryProduct(product);
    setShowHistoryModal(true);
    setHistoryStartDate('');
    setHistoryEndDate('');
    await fetchHistory(product, '', '');
  };

  // Client-side Excel importer
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          throw new Error("File Excel rỗng hoặc không đúng định dạng.");
        }

        // Standardize headers
        // Map columns like: "Mã sản phẩm" -> "code", "Tên sản phẩm" -> "name"
        const mappedItems = data.map(row => {
          return {
            code: row["Mã sản phẩm"] || row["Mã"] || row["code"] || row["Code"],
            name: row["Tên sản phẩm"] || row["Tên"] || row["name"] || row["Name"],
            category: row["Nhóm VTHH"] || row["Danh mục"] || row["Loại"] || row["category"] || row["Category"] || "Chưa phân loại",
            unit: row["Đơn vị tính"] || row["Đơn vị"] || row["unit"] || row["Unit"] || "",
            quantity: Number(row["Số lượng"] || row["Tồn kho"] || row["quantity"] || 0),
            price: Number(row["Đơn giá"] || row["Giá"] || row["price"] || 0),
            minStock: Number(row["Ngưỡng tồn thấp"] || row["Tồn tối thiểu"] || row["minStock"] || 10),
          };
        });

        const res = await fetchWithAuth('/api/products/import', {
          method: 'POST',
          body: JSON.stringify({ items: mappedItems, warehouseId: selectedWarehouse?.id }),
        });

        if (!res.ok) {
          throw new Error("Không thể gửi dữ liệu import lên server");
        }

        const result = await res.json();
        const updatedMsg = result.updatedCount > 0 ? ` Cập nhật ${result.updatedCount} mã hiện có.` : '';
        const skippedMsg = result.skippedCount > 0 ? ` Bỏ qua ${result.skippedCount} dòng lỗi/trống.` : '';
        setSuccessMsg(`Import thành công! Đã thêm ${result.importedCount} sản phẩm mới.${updatedMsg}${skippedMsg}`);
        fetchProducts();
      } catch (err: any) {
        setError(err.message || "Lỗi xử lý file Excel. Vui lòng kiểm tra định dạng cột.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  // Download Warehouse Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Mã sản phẩm": "PIN-LONGI-450",
        "Tên sản phẩm": "Tấm pin năng lượng mặt trời Longi 450W",
        "Nhóm VTHH": "Tấm Pin",
        "Đơn vị tính": "Tấm",
        "Số lượng": 100,
        "Đơn giá": 2450000,
        "Ngưỡng tồn thấp": 10
      }
    ];

    const ws = xlsx.utils.json_to_sheet(templateData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Mẫu Vật Tư");
    xlsx.writeFile(wb, "Mau_Nhap_Kho_Vat_Tu.xlsx");
  };

  // Export Warehouse to Excel
  const handleExportExcel = () => {
    const exportData = productsList.map(p => ({
      "Mã sản phẩm": p.code,
      "Tên sản phẩm": p.name,
      "Nhóm VTHH": p.category || "Chưa phân loại",
      "Đơn vị tính": p.unit || "",
      "Số lượng": p.quantity,
      "Đơn giá": p.price,
      "Ngưỡng tồn thấp": p.minStock
    }));

    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Kho Vật Tư");
    xlsx.writeFile(wb, `Danh_Sach_${selectedWarehouse?.code || "Kho"}.xlsx`);
  };

  const filteredProducts = React.useMemo(() => {
    if (!searchTerm.trim()) return productsList;
    const normalizedSearch = removeAccents(searchTerm);
    return productsList.filter(product => {
      const normName = removeAccents(product.name || '');
      const normCode = removeAccents(product.code || '');
      const normCategory = removeAccents(product.category || '');
      return normName.includes(normalizedSearch) || 
             normCode.includes(normalizedSearch) || 
             normCategory.includes(normalizedSearch);
    });
  }, [productsList, searchTerm]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const displayedProducts = React.useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredProducts, currentPage]);


  if (!selectedWarehouse) {
    return <WarehouseManager onSelectWarehouse={setSelectedWarehouse} />;
  }

  return (
    <div id="warehouse_container" className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><button onClick={() => setSelectedWarehouse(null)} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-500 hover:text-slate-700" title="Quay lại danh sách kho"><ChevronLeft className="w-5 h-5" /></button><h1 className="font-display text-lg font-bold tracking-tight text-slate-900">Kho: {selectedWarehouse.name}</h1></div>
          <p className="text-xs text-slate-500">Tra cứu, nhập xuất kho vật tư năng lượng mặt trời</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 text-xs font-semibold rounded-md border border-emerald-200 cursor-pointer transition-colors shadow-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Nhập từ Excel</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleExcelImport} 
            />
          </label>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 text-xs font-semibold rounded-md border border-blue-200 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-800 text-xs font-semibold rounded-md border border-slate-200 transition-colors shadow-xs"
            title="Tải File Mẫu Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải File Mẫu</span>
          </button>
          
          <button
            id="btn_add_product"
            onClick={() => {
              setEditProductId(null);
              setNewCode('');
              setNewName('');
              setNewCategory('');
              setNewUnit('');
              setNewPrice(0);
              setNewQuantity(0);
              setNewMinStock(10);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm vật tư mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-start gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Filter and Search Panel - Dense layout */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-2.5 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã, tên, Nhóm VTHH..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" /> Bộ lọc:
          </span>
          
          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all flex items-center gap-1 ${
              filterLowStock 
                ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs font-bold' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Tồn kho thấp</span>
          </button>

          <button
            onClick={() => setFilterInStock(!filterInStock)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all flex items-center gap-1 ${
              filterInStock 
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs font-bold' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3 h-3 text-indigo-500" />
            <span>Còn hàng</span>
          </button>

          {(filterLowStock || filterInStock || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterLowStock(false);
                setFilterInStock(false);
              }}
              className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Materials Table - Compact (reduced py-2 px-3) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-2 px-3 w-32">Mã Vật Tư</th>
                <th className="py-2 px-3">Tên Sản Phẩm</th>
                <th className="py-2 px-3 w-32">Nhóm VTHH</th>
                <th className="py-2 px-3 w-20">ĐVT</th>
                <th className="py-2 px-3 w-32 text-right">Tồn Kho</th>
                <th className="py-2 px-3 w-32 text-right">Đơn Giá Mặc Định</th>
                <th className="py-2 px-3 w-28 text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-500" />
                    <span>Đang tải danh sách vật tư...</span>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Không tìm thấy vật tư phù hợp.
                  </td>
                </tr>
              ) : (
                displayedProducts.map((product) => {
                  const isLow = product.quantity <= product.minStock;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-1.5 px-3 font-mono font-medium text-slate-700">
                        {product.code}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="font-bold text-slate-900 leading-tight">{product.name}</div>
                        {isLow && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 mt-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-500" /> Cảnh báo: dưới {product.minStock}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded">
                          {product.category}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">
                        <span className="text-[11px] text-slate-600">
                          {product.unit || '-'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold">
                        <span className={isLow ? 'text-amber-600 font-black' : 'text-slate-900'}>
                          {formatQuantity(product.quantity)}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-600">
                        {formatVND(product.price)} đ
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                           <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setTxType('NHAP');
                              setShowTxModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Nhập xuất kho"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => viewStockHistory(product)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Xem lịch sử xuất nhập"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleEditClick(product)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <div>
              Hiển thị từ <span className="font-semibold">{((currentPage - 1) * itemsPerPage) + 1}</span> đến <span className="font-semibold">{Math.min(currentPage * itemsPerPage, productsList.length)}</span> trong tổng số <span className="font-semibold">{productsList.length}</span> vật tư
            </div>
            
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Trước
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isFirst = pageNum === 1;
                const isLast = pageNum === totalPages;
                const isNearCurrent = Math.abs(pageNum - currentPage) <= 1;

                if (isFirst || isLast || isNearCurrent) {

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-md text-xs font-semibold border transition-all ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }

                // Ellipsis condition
                if (pageNum === 2 && currentPage > 3) {
                  return <span key="ellipsis-start" className="px-1 text-slate-400">...</span>;
                }
                if (pageNum === totalPages - 1 && currentPage < totalPages - 2) {
                  return <span key="ellipsis-end" className="px-1 text-slate-400">...</span>;
                }

                return null;
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display font-semibold text-slate-800">{editProductId ? 'Cập Nhật Vật Tư' : 'Thêm Vật Tư Năng Lượng Mặt Trời'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            
            <form onSubmit={handleAddProduct} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mã Vật Tư (Duy nhất)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: PIN-CANADIAN-450W"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên Vật Tư / Thiết Bị</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tấm pin năng lượng Canadian Solar 450W"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nhóm VTHH</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Tấm pin, Inverter..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Tấm, Mét, bộ, cái..."
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Đơn Giá Mặc Định (VND)</label>
                  <PriceInput
                    value={newPrice}
                    onChange={(val) => setNewPrice(val)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tồn Kho Ban Đầu</label>
                  <QuantityInput
                    value={newQuantity}
                    onChange={(val) => setNewQuantity(val)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ngưỡng Tồn Thấp Cảnh Báo</label>
                <input
                  type="number"
                  min="1"
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  {editProductId ? 'Cập Nhật Thiết Bị' : 'Lưu thiết bị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transaction Modal (Nhập/Xuất kho thủ công) */}
      {showTxModal && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-slate-800">Điều Chỉnh Kho Vật Tư</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedProduct.code} - {selectedProduct.name}</p>
              </div>
              <button onClick={() => setShowTxModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            
            <form onSubmit={handleStockAction} className="p-5 space-y-4">
              <div className="flex gap-4">
                <label className="flex-1 flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer transition-all hover:bg-slate-50 border-emerald-200 has-checked:bg-emerald-50/50 has-checked:border-emerald-500">
                  <input
                    type="radio"
                    name="tx_type"
                    checked={txType === 'NHAP'}
                    onChange={() => setTxType('NHAP')}
                    className="accent-emerald-600"
                  />
                  <span className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
                    <ArrowDownRight className="w-4 h-4 text-emerald-500" /> Nhập Kho (+)
                  </span>
                </label>
                
                <label className="flex-1 flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer transition-all hover:bg-slate-50 border-red-200 has-checked:bg-red-50/50 has-checked:border-red-500">
                  <input
                    type="radio"
                    name="tx_type"
                    checked={txType === 'XUAT'}
                    onChange={() => setTxType('XUAT')}
                    className="accent-red-600"
                  />
                  <span className="text-sm font-semibold text-red-700 flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4 text-red-500" /> Xuất Kho (-)
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số Lượng Giao Dịch</label>
                <QuantityInput
                  value={txQty}
                  onChange={(val) => setTxQty(val)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-semibold text-slate-800"
                />
                <p className="text-xs text-slate-400 mt-1">Hàng tồn hiện tại: <b>{formatQuantity(selectedProduct.quantity)}</b></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Lý Do / Ghi Chú</label>
                <textarea
                  placeholder="Ví dụ: Nhập hàng từ nhà máy Canadian Solar..."
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-20 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-sm ${
                    txType === 'NHAP' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {txType === 'NHAP' ? 'Xác nhận Nhập Kho' : 'Xác nhận Xuất Kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-[95vw] w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-slate-800">Lịch Sử Giao Dịch Kho</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{historyProduct.code} - {historyProduct.name}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-end gap-3 bg-white">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Từ ngày</label>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Đến ngày</label>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Sắp xếp</label>
                <select
                  value={historySortOrder}
                  onChange={(e) => {
                    setHistorySortOrder(e.target.value as 'desc' | 'asc');
                    setHistoryPage(1); // Reset page on sort change
                  }}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded focus:border-indigo-500 outline-none"
                >
                  <option value="desc">Mới nhất tới cũ nhất</option>
                  <option value="asc">Cũ nhất tới mới nhất</option>
                </select>
              </div>
              <button
                onClick={() => fetchHistory(historyProduct, historyStartDate, historyEndDate)}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 text-xs font-bold"
              >
                Lọc
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loadingHistory ? (
                <div className="text-center py-6 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                  <span>Đang tải lịch sử...</span>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  {txHistory.length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 border border-slate-200 rounded-lg">
                      Không có giao dịch kho nào trong khoảng thời gian này.
                    </div>
                  )}
                  <div className="w-full overflow-x-auto rounded-lg border border-slate-200 max-h-[60vh]">
                    <table className="w-full text-left border-collapse min-w-[1000px] relative">
                    <thead className="bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3 border-b border-slate-200" rowSpan={2}>Ngày Giao Dịch</th>
                        <th className="py-2 px-3 border-b border-slate-200" rowSpan={2}>Tên khách / Nhà Cung Cấp</th>
                        <th className="py-2 px-3 border-b border-slate-200" rowSpan={2}>Số Chứng từ</th>
                        <th className="py-2 px-3 border-b border-slate-200" rowSpan={2}>Đơn vị</th>
                        <th className="py-2 px-3 border-b border-slate-200 text-right" rowSpan={2}>Đơn giá (VND)</th>
                        <th className="py-1 px-3 border-b border-l border-slate-200 text-center bg-emerald-50/50 text-emerald-700" colSpan={2}>NHẬP</th>
                        <th className="py-1 px-3 border-b border-l border-slate-200 text-center bg-red-50/50 text-red-700" colSpan={2}>XUẤT</th>
                        <th className="py-1 px-3 border-b border-l border-slate-200 text-center bg-blue-50/50 text-blue-700" colSpan={2}>TỒN CUỐI</th>
                      </tr>
                      <tr>
                        <th className="py-1 px-3 border-b border-l border-slate-200 text-right bg-emerald-50/50">Số lượng</th>
                        <th className="py-1 px-3 border-b border-slate-200 text-right bg-emerald-50/50">Giá trị</th>
                        <th className="py-1 px-3 border-b border-l border-slate-200 text-right bg-red-50/50">Số lượng</th>
                        <th className="py-1 px-3 border-b border-slate-200 text-right bg-red-50/50">Giá trị</th>
                        <th className="py-1 px-3 border-b border-l border-slate-200 text-right bg-blue-50/50">Số lượng</th>
                        <th className="py-1 px-3 border-b border-slate-200 text-right bg-blue-50/50">Giá trị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {sortedTxHistory.slice((historyPage - 1) * 30, historyPage * 30).map((tx) => {
                        const isImport = tx.type === 'NHAP' || tx.type === 'BO_GHI_SO';
                        const isExport = tx.type === 'XUAT' || tx.type === 'GHI_SO';
                        
                        const importQty = isImport ? tx.quantity : 0;
                        const exportQty = isExport ? tx.quantity : 0;
                        const unitPrice = tx.unitPrice || historyProduct.price;
                        const importVal = importQty * unitPrice;
                        const exportVal = exportQty * unitPrice;
                        const balanceQty = tx.runningBalance || 0;
                        const balanceVal = balanceQty * unitPrice;
                        
                        const handleDocClick = () => {
                          if (tx.docNumber) {
                            const noteLower = tx.note?.toLowerCase() || "";
                            const isPurchase = tx.docNumber.startsWith('PN-') || 
                                               noteLower.includes('nhập') || 
                                               noteLower.includes('purchase') || 
                                               noteLower.includes('phieu nhap');
                            window.dispatchEvent(new CustomEvent('OPEN_DOC', {
                              detail: { docNumber: tx.docNumber, type: isPurchase ? 'purchase' : 'invoice' }
                            }));
                            setShowHistoryModal(false);
                          }
                        };


                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : ''}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {tx.partnerName || (
                                <span className="text-slate-400 italic">
                                  {tx.type === 'NHAP' ? 'Nhập kho thủ công' : tx.type === 'XUAT' ? 'Xuất kho thủ công' : tx.note}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {tx.docNumber ? (
                                <button 
                                  onClick={handleDocClick}
                                  className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                >
                                  {tx.docNumber}
                                </button>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {historyProduct.category.toLowerCase().includes('pin') ? 'Tấm' : 'Bộ/Cái'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              {formatVND(unitPrice)}
                            </td>
                            
                            {/* NHAP */}
                            <td className="py-2 px-3 border-l text-right font-bold text-emerald-700 bg-emerald-50/20">
                              {importQty > 0 ? formatQuantity(importQty) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700 bg-emerald-50/20">
                              {importVal > 0 ? formatVND(importVal) : '-'}
                            </td>
                            
                            {/* XUAT */}
                            <td className="py-2 px-3 border-l text-right font-bold text-red-700 bg-red-50/20">
                              {exportQty > 0 ? formatQuantity(exportQty) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-red-700 bg-red-50/20">
                              {exportVal > 0 ? formatVND(exportVal) : '-'}
                            </td>
                            
                            {/* TON CUOI */}
                            <td className="py-2 px-3 border-l text-right font-bold text-blue-800 bg-blue-50/20">
                              {formatQuantity(balanceQty)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-blue-800 bg-blue-50/20">
                              {formatVND(balanceVal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold sticky bottom-0 z-10 shadow-[0_-1px_0_rgba(203,213,225,1)]">
                      <tr className="text-[11px] text-slate-700">
                        <td colSpan={5} className="py-2.5 px-3 text-right">TỔNG CỘNG:</td>
                        
                        <td className="py-2.5 px-3 border-l text-right text-emerald-700 bg-emerald-50/90">
                          {historyTotals.totalImportQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 bg-emerald-50/90">
                          {formatVND(historyTotals.totalImportVal)}
                        </td>
                        
                        <td className="py-2.5 px-3 border-l text-right text-red-700 bg-red-50/90">
                          {historyTotals.totalExportQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-red-700 bg-red-50/90">
                          {formatVND(historyTotals.totalExportVal)}
                        </td>
                        
                        <td className="py-2.5 px-3 border-l text-right text-blue-800 bg-blue-50/90">
                          {historyTotals.finalBalanceQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-800 bg-blue-50/90">
                          {formatVND(historyTotals.finalBalanceVal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Pagination */}
                {Math.ceil(txHistory.length / 30) > 1 && (
                  <div className="flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-lg">
                    <div className="text-xs text-slate-500">
                      Hiển thị <span className="font-medium text-slate-700">{(historyPage - 1) * 30 + 1}</span> đến <span className="font-medium text-slate-700">{Math.min(historyPage * 30, txHistory.length)}</span> trong số <span className="font-medium text-slate-700">{txHistory.length}</span> giao dịch
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="px-3 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                      >
                        Trang trước
                      </button>
                      <span className="px-3 py-1 text-xs font-bold text-slate-700">
                        {historyPage} / {Math.ceil(txHistory.length / 30)}
                      </span>
                      <button
                        onClick={() => setHistoryPage(p => Math.min(Math.ceil(txHistory.length / 30), p + 1))}
                        disabled={historyPage >= Math.ceil(txHistory.length / 30)}
                        className="px-3 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
