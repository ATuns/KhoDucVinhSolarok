import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Customer, Supplier, Invoice, PurchaseOrder, formatVND } from '../types.ts';
import { Search, User, Phone, MapPin, ShoppingBag, RefreshCw, Plus, Edit2, CheckCircle2, AlertTriangle, Truck, FileText, FileSpreadsheet, Download } from 'lucide-react';
import * as xlsx from 'xlsx';

export const CustomersTab: React.FC = () => {
  const { fetchWithAuth } = useAuth();
  const [partnerType, setPartnerType] = useState<'customer' | 'supplier'>('customer');
  const [partnersList, setPartnersList] = useState<(Customer | Supplier)[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Historical state
  const [selectedPartner, setSelectedPartner] = useState<Customer | Supplier | null>(null);
  const [history, setHistory] = useState<(Invoice | PurchaseOrder)[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const historyItemsPerPage = 30;

  // Form state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formTaxId, setFormTaxId] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Download Excel Template
  const handleDownloadTemplate = () => {
    const isCustomer = partnerType === 'customer';
    const filename = isCustomer ? "Mau_Nhap_Khach_Hang.xlsx" : "Mau_Nhap_Nha_Cung_Cap.xlsx";
    const headerName = isCustomer ? "Tên khách hàng" : "Tên nhà cung cấp";
    
    const templateData = [
      {
        [headerName]: isCustomer ? "Nguyễn Văn A" : "Công ty TNHH Thiết bị Solar ABC",
        "Số điện thoại": "0912345678",
        "Địa chỉ": isCustomer ? "123 Đường Láng, Đống Đa, Hà Nội" : "456 Đường Lê Lợi, Quận 1, TP.HCM",
        "Mã số thuế": isCustomer ? "0102030405" : "0312345678"
      }
    ];

    const ws = xlsx.utils.json_to_sheet(templateData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, isCustomer ? "Khách Hàng" : "Nhà Cung Cấp");
    xlsx.writeFile(wb, filename);
  };

  // Export Customers/Suppliers to Excel
  const handleExportExcel = () => {
    const isCustomer = partnerType === 'customer';
    const filename = isCustomer ? "Danh_Sach_Khach_Hang.xlsx" : "Danh_Sach_Nha_Cung_Cap.xlsx";
    const headerName = isCustomer ? "Tên khách hàng" : "Tên nhà cung cấp";

    const exportData = partnersList.map(partner => ({
      [headerName]: partner.name,
      "Số điện thoại": partner.phone || "",
      "Địa chỉ": partner.address || "",
      "Mã số thuế": partner.taxId || ""
    }));

    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, isCustomer ? "Khách Hàng" : "Nhà Cung Cấp");
    xlsx.writeFile(wb, filename);
  };

  // Import Customers/Suppliers from Excel
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');

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

        const isCustomer = partnerType === 'customer';
        const partnerNameHeader = isCustomer ? "Tên khách hàng" : "Tên nhà cung cấp";

        const mappedItems = data.map(row => {
          const name = row[partnerNameHeader] || row["Tên đối tác"] || row["Tên"] || row["name"] || row["Name"];
          const phone = row["Số điện thoại"] || row["SĐT"] || row["phone"] || row["Phone"] || "";
          const address = row["Địa chỉ"] || row["address"] || row["Address"] || "";
          const taxId = row["Mã số thuế"] || row["MST"] || row["taxId"] || row["TaxId"] || "";

          return {
            name: name ? String(name).trim() : "",
            phone: phone ? String(phone).trim() : "",
            address: address ? String(address).trim() : "",
            taxId: taxId ? String(taxId).trim() : "",
          };
        }).filter(item => item.name);

        if (mappedItems.length === 0) {
          throw new Error(`Không tìm thấy cột "${partnerNameHeader}" hoặc dữ liệu tên bị trống.`);
        }

        const endpoint = isCustomer ? '/api/customers/import' : '/api/suppliers/import';
        const res = await fetchWithAuth(endpoint, {
          method: 'POST',
          body: JSON.stringify({ items: mappedItems }),
        });

        if (!res.ok) {
          throw new Error("Không thể gửi dữ liệu import lên server");
        }

        const result = await res.json();
        alert(`Import thành công! Đã thêm ${result.importedCount} đối tác mới. Bỏ qua ${result.skippedCount} đối tác trùng tên.`);
        fetchPartners();
      } catch (err: any) {
        setErrorMsg(err.message || "Lỗi xử lý file Excel. Vui lòng kiểm tra định dạng cột.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const fetchPartners = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const endpoint = partnerType === 'customer' ? '/api/customers' : '/api/suppliers';
      const res = await fetchWithAuth(`${endpoint}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPartnersList(data);
      } else {
        throw new Error("Không thể tải danh sách đối tác");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    setHistoryCurrentPage(1);
    fetchPartners();
    setSelectedPartner(null);
    setHistory([]);
  }, [searchTerm, partnerType]);

  const viewHistory = async (partner: Customer | Supplier) => {
    setSelectedPartner(partner);
    setLoadingHistory(true);
    setHistory([]);
    setHistoryCurrentPage(1);
    try {
      const endpoint = partnerType === 'customer' 
        ? `/api/customers/${partner.id}/history` 
        : `/api/suppliers/${partner.id}/history`;
      const res = await fetchWithAuth(endpoint);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddClick = () => {
    setEditId(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormTaxId('');
    setShowFormModal(true);
  };

  const handleEditClick = (e: React.MouseEvent, partner: Customer | Supplier) => {
    e.stopPropagation();
    setEditId(partner.id);
    setFormName(partner.name);
    setFormPhone(partner.phone || '');
    setFormAddress(partner.address || '');
    setFormTaxId(partner.taxId || '');
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setFormSaving(true);
    try {
      const endpoint = partnerType === 'customer' ? '/api/customers' : '/api/suppliers';
      const url = editId ? `${endpoint}/${editId}` : endpoint;
      const method = editId ? 'PUT' : 'POST';
      
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          address: formAddress,
          taxId: formTaxId
        })
      });
      
      if (!res.ok) throw new Error("Lỗi khi lưu đối tác");
      
      setShowFormModal(false);
      fetchPartners();
      if (selectedPartner && editId === selectedPartner.id) {
        setSelectedPartner({...selectedPartner, name: formName, phone: formPhone, address: formAddress,
          taxId: formTaxId});
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setFormSaving(false);
    }
  };

  const totalPages = Math.ceil(partnersList.length / itemsPerPage);

  const displayedPartners = React.useMemo(() => {
    return partnersList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [partnersList, currentPage]);

  const historyTotalPages = Math.ceil(history.length / historyItemsPerPage);

  const displayedHistory = React.useMemo(() => {
    return history.slice((historyCurrentPage - 1) * historyItemsPerPage, historyCurrentPage * historyItemsPerPage);
  }, [history, historyCurrentPage]);

  return (
    <div id="customers_container" className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* List Column */}
      <div className="md:col-span-1 space-y-3 flex flex-col h-[calc(100vh-140px)]">
        <div>
          <h1 className="font-display text-base font-bold tracking-tight text-slate-900">Danh Sách Đối Tác</h1>
          <p className="text-[11px] text-slate-500">Quản lý khách hàng và nhà cung cấp</p>
        </div>
        
        {/* Type Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setPartnerType('customer')}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${
              partnerType === 'customer' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Khách hàng
          </button>
          <button
            onClick={() => setPartnerType('supplier')}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${
              partnerType === 'supplier' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Nhà cung cấp
          </button>
        </div>

        {/* Action & Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-semibold text-slate-800"
            />
          </div>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm
          </button>
        </div>

        {/* Excel Import / Export Row */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100/50 p-1.5 rounded-lg border border-slate-200/50">
          <label className="flex items-center justify-center gap-1 px-1.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-700 text-[10px] font-bold rounded-md cursor-pointer transition-colors shadow-2xs">
            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
            <span>Nhập Excel</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleExcelImport} 
            />
          </label>
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1 px-1.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-700 text-[10px] font-bold rounded-md transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3 h-3 text-blue-600" />
            <span>Xuất Excel</span>
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center justify-center gap-1 px-1.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-700 text-[10px] font-bold rounded-md transition-colors shadow-2xs"
            title="Tải file mẫu Excel"
          >
            <Download className="w-3 h-3 text-indigo-600" />
            <span>File Mẫu</span>
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-2 rounded-md text-xs font-medium flex items-center gap-1.5 border border-red-100">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* List scroll area */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-100 flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="text-center py-6 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-indigo-500" />
              <span className="text-[11px]">Đang tải...</span>
            </div>
          ) : partnersList.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 font-semibold italic">Không tìm thấy đối tác.</div>
          ) : (
            displayedPartners.map((partner) => (
              <button
                key={partner.id}
                onClick={() => viewHistory(partner)}
                className={`w-full text-left p-2.5 flex items-start gap-2.5 transition-colors group ${
                  selectedPartner?.id === partner.id ? 'bg-indigo-50/50 border-r-4 border-indigo-600 font-bold' : 'hover:bg-slate-50/50'
                }`}
              >
                <div className={`p-1.5 rounded mt-0.5 shrink-0 ${partnerType === 'customer' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {partnerType === 'customer' ? <User className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                </div>
                <div className="space-y-0.5 text-xs flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-900 text-xs leading-tight truncate pr-2">{partner.name}</h4>
                    <div 
                      onClick={(e) => handleEditClick(e, partner)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all rounded hover:bg-white"
                      title="Sửa thông tin"
                    >
                      <Edit2 className="w-3 h-3" />
                    </div>
                  </div>
                  {partner.phone && (
                    <p className="text-slate-500 flex items-center gap-1 font-mono text-[10px]">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{partner.phone}</span>
                    </p>
                  )}
                  {partner.taxId && (
                    <p className="text-slate-500 flex items-center gap-1 font-mono text-[10px]">
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>MST: {partner.taxId}</span>
                    </p>
                  )}
                  {partner.address && (
                    <p className="text-slate-400 flex items-center gap-1 leading-tight truncate text-[10px]">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{partner.address}</span>
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-600 shrink-0">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-2 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              Trước
            </button>
            <span className="font-semibold text-[11px] text-slate-600">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-2 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              Sau
            </button>
          </div>
        )}
      </div>

      {/* Historical Purchase Column */}
      <div className="md:col-span-2 flex flex-col h-[calc(100vh-140px)]">
        {selectedPartner ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 flex flex-col h-full min-h-0">
            <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  <span>Lịch Sử Giao Dịch: {selectedPartner.name}</span>
                </h3>
                <div className="flex items-center gap-3 mt-0.5">
                  {selectedPartner.phone && <p className="text-[10px] text-slate-400 font-mono">Liên lạc: {selectedPartner.phone}</p>}
                  {selectedPartner.taxId && <p className="text-[10px] text-slate-400 font-mono">MST: {selectedPartner.taxId}</p>}
                </div>
              </div>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-xs shrink-0">
                {history.length} giao dịch
              </span>
            </div>
            
            <div className="mt-3 space-y-2 flex-1 overflow-y-auto min-h-0 pr-1">
              {loadingHistory ? (
                <div className="text-center py-10 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-500" />
                  <span className="text-xs">Đang tải lịch sử giao dịch...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs italic font-semibold">
                  Đối tác này chưa phát sinh giao dịch nào.
                </div>
              ) : (
                displayedHistory.map((record: any) => {
                  const isCustomer = partnerType === 'customer';
                  const code = isCustomer ? record.invoiceNumber : record.poNumber;
                  const total = isCustomer ? record.totalAmount : (record.totalAmount || 0); // Need to calculate total for POs if not present in API, but let's assume it's there or just show status. For POs, the API currently returns full PO object, we might not have totalAmount in it. Let's just show what we have.
                  
                  return (
                    <div key={record.id} className="p-2.5 border border-slate-100 rounded-md hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs">#{code}</span>
                          <span className="font-mono text-slate-400 text-[10px]">({record.documentCode})</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                          <span>Ngày: <b>{record.createdAt ? new Date(record.createdAt).toLocaleDateString('vi-VN') : ''}</b></span>
                          <span>•</span>
                          <span>Trạng thái: 
                            <b className="ml-1 uppercase text-slate-700 text-[10px]">
                              {record.status === 'CTT' ? 'Chưa thanh toán' : record.status === 'TM' ? 'Tiền mặt' : record.status === 'CK' ? 'Chuyển khoản' : record.status}
                            </b>
                          </span>
                        </div>
                      </div>
                      
                      {isCustomer && (
                        <div className="text-left sm:text-right">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Tổng giá trị</div>
                          <span className="font-mono font-bold text-slate-900 text-xs">{formatVND(record.totalAmount)} đ</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* History Pagination Controls */}
            {!loadingHistory && historyTotalPages > 1 && (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-600 shrink-0 mt-3">
                <button
                  type="button"
                  disabled={historyCurrentPage === 1}
                  onClick={() => setHistoryCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  Trước
                </button>
                <span className="font-semibold text-[11px] text-slate-600">
                  Trang {historyCurrentPage} / {historyTotalPages}
                </span>
                <button
                  type="button"
                  disabled={historyCurrentPage === historyTotalPages}
                  onClick={() => setHistoryCurrentPage(prev => Math.min(prev + 1, historyTotalPages))}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
            <User className="w-8 h-8 text-slate-300 mb-1.5" />
            <h3 className="font-bold text-slate-600 text-sm">Chưa Chọn Đối Tác</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">Bấm chọn một khách hàng hoặc nhà cung cấp ở cột danh sách bên trái để xem đầy đủ thông tin chi tiết giao dịch của họ.</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-display font-bold text-slate-800 text-sm">
                {editId ? 'Sửa thông tin' : 'Thêm mới'} {partnerType === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'}
              </h2>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên {partnerType === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'} *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="Nhập tên..."
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="Nhập số điện thoại..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="Nhập địa chỉ..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mã số thuế</label>
                <input
                  type="text"
                  value={formTaxId}
                  onChange={(e) => setFormTaxId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="Nhập mã số thuế..."
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-1.5 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {formSaving ? 'Đang lưu...' : 'Lưu lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
