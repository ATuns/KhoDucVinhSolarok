import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Users, Truck, ChevronDown, ChevronRight, ChevronLeft, FileText, CheckCircle2, Search, Download } from 'lucide-react';
import { formatVND } from '../types.ts';
import * as xlsx from 'xlsx';
import { searchMatch } from '../utils.ts';

interface DepositInfo {
  id: number;
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

interface DebtDocument {
  id: number;
  documentCode: string;
  invoiceNumber: string;
  totalAmount: number;
  deposit: number;
  depositsList?: DepositInfo[];
  createdAt: string;
}

interface UnifiedDebt {
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  unpaidCount: number;
  totalAmount: number;
  totalDeposits: number;
  documents: DebtDocument[];
  debtAmount: number;
}

export const DebtTab: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const { fetchWithAuth } = useAuth();
  
  const [activeSubTab, setActiveSubTab] = useState<'payables' | 'receivables'>('payables');
  
  const [payables, setPayables] = useState<UnifiedDebt[]>([]);
  const [receivables, setReceivables] = useState<UnifiedDebt[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [docPage, setDocPage] = useState(1);
  const itemsPerPage = 10;
  const docItemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSubTab, searchTerm]);

  useEffect(() => {
    loadDebts();
  }, [refreshTrigger]);

  const loadDebts = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetchWithAuth('/api/debts');
      if (res.ok) {
        const data = await res.json();
        const newPayables: UnifiedDebt[] = [];
        const newReceivables: UnifiedDebt[] = [];

        data.forEach((item: any) => {
          const totalAmount = Number(item.totalAmount);
          const totalDeposits = Number(item.totalDeposits);
          const diff = totalAmount - totalDeposits;

          if (diff === 0) return;

          if (item.type === 'CUSTOMER') {
            if (diff > 0) {
              newReceivables.push({ ...item, debtAmount: diff });
            } else if (diff < 0) {
              newPayables.push({ ...item, debtAmount: Math.abs(diff) });
            }
          } else if (item.type === 'SUPPLIER') {
            if (diff > 0) {
              newPayables.push({ ...item, debtAmount: diff });
            } else if (diff < 0) {
              newReceivables.push({ ...item, debtAmount: Math.abs(diff) });
            }
          }
        });

        // Sort by debtAmount descending
        newPayables.sort((a, b) => b.debtAmount - a.debtAmount);
        newReceivables.sort((a, b) => b.debtAmount - a.debtAmount);

        setPayables(newPayables);
        setReceivables(newReceivables);
      } else {
        throw new Error("Không thể lấy dữ liệu công nợ");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setDocPage(1);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatVND(amount) + ' đ';
  };

  const activeData = activeSubTab === 'payables' ? payables : receivables;
  
  const filteredData = activeData.filter(d => 
    searchMatch(d.partnerName, searchTerm) || 
    (d.partnerPhone && d.partnerPhone.includes(searchTerm)) ||
    d.documents.some(doc => searchMatch(doc.documentCode, searchTerm))
  );

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportExcel = () => {
    const exportData: any[] = [];
    
    filteredData.forEach(d => {
      // Dòng tổng cộng của khách hàng/nhà cung cấp
      exportData.push({
        "Phân loại": d.type === 'CUSTOMER' ? "Khách hàng" : "Nhà cung cấp",
        "Tên đối tác": `TỔNG CỘNG: ${d.partnerName}`,
        "Số điện thoại": d.partnerPhone || "",
        "Mã chứng từ": `(${d.unpaidCount} chứng từ)`,
        "Ngày chứng từ": "",
        "Tổng tiền (đ)": d.totalAmount,
        "Đã thanh toán (đ)": d.totalDeposits,
        [activeSubTab === 'payables' ? "Số tiền đang nợ (đ)" : "Số tiền phải thu (đ)"]: d.debtAmount,
        "Trả dư (đ)": ""
      });

      // Chi tiết từng hóa đơn/chứng từ
      d.documents.forEach(doc => {
        const docDebt = doc.totalAmount - doc.deposit;
        
        exportData.push({
          "Phân loại": "",
          "Tên đối tác": d.partnerName,
          "Số điện thoại": "",
          "Mã chứng từ": doc.documentCode,
          "Ngày chứng từ": new Date(doc.createdAt).toLocaleDateString('vi-VN'),
          "Tổng tiền (đ)": doc.totalAmount,
          "Đã thanh toán (đ)": doc.deposit,
          [activeSubTab === 'payables' ? "Số tiền đang nợ (đ)" : "Số tiền phải thu (đ)"]: docDebt > 0 ? docDebt : 0,
          "Trả dư (đ)": docDebt < 0 ? Math.abs(docDebt) : 0,
        });
      });
      
      // Dòng trống để cách biệt
      exportData.push({
        "Phân loại": "",
        "Tên đối tác": "",
        "Số điện thoại": "",
        "Mã chứng từ": "",
        "Ngày chứng từ": "",
        "Tổng tiền (đ)": "",
        "Đã thanh toán (đ)": "",
        [activeSubTab === 'payables' ? "Số tiền đang nợ (đ)" : "Số tiền phải thu (đ)"]: "",
        "Trả dư (đ)": ""
      });
    });

    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, activeSubTab === 'payables' ? "Toi_Dang_No" : "Toi_Phai_Thu");
    xlsx.writeFile(wb, activeSubTab === 'payables' ? "Danh_Sach_Toi_Dang_No.xlsx" : "Danh_Sach_Toi_Phai_Thu.xlsx");
  };

  const navigateToDocument = (doc: DebtDocument, type: string) => {
    const docType = type === 'CUSTOMER' ? 'invoice' : 'purchase';
    window.dispatchEvent(new CustomEvent('OPEN_DOC', {
      detail: { docNumber: doc.documentCode, type: docType }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Đang tải dữ liệu công nợ...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center justify-between">
        <p className="font-semibold">{errorMsg}</p>
        <button onClick={loadDebts} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm font-bold transition-colors">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => { setActiveSubTab('payables'); setExpandedId(null); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${
              activeSubTab === 'payables' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Tôi Đang Nợ ({payables.length})</span>
          </button>
          
          <button
            onClick={() => { setActiveSubTab('receivables'); setExpandedId(null); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${
              activeSubTab === 'receivables' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tôi Phải Thu ({receivables.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm đối tác hoặc số chứng từ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg transition-colors border border-emerald-200"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Xuất Excel</span>
        </button>
      </div>

      {/* Debt List */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-300 mb-3" />
            <p className="text-slate-600 font-semibold">{searchTerm ? "Không tìm thấy kết quả phù hợp" : (activeSubTab === 'payables' ? "Bạn hiện không có khoản nợ nào" : "Bạn hiện không có khoản phải thu nào")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedData.map(d => {
              const isExpanded = expandedId === (d.partnerId + d.type);
              
              const totalDocPages = Math.ceil(d.documents.length / docItemsPerPage);
              const paginatedDocs = d.documents.slice((docPage - 1) * docItemsPerPage, docPage * docItemsPerPage);
              
              return (
                <div key={d.partnerId + d.type} className="flex flex-col">
                  <div 
                    className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(d.partnerId + d.type)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${d.type === 'CUSTOMER' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                        {d.partnerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                          {d.partnerName}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${d.type === 'CUSTOMER' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                            {d.type === 'CUSTOMER' ? 'Khách hàng' : 'Nhà cung cấp'}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 flex gap-2 mt-0.5">
                          {d.partnerPhone && <span>SĐT: {d.partnerPhone}</span>}
                          <span>• {d.unpaidCount} chứng từ</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`font-bold text-lg ${activeSubTab === 'payables' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatCurrency(d.debtAmount)}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">
                          {activeSubTab === 'payables' ? 'SỐ TIỀN ĐANG NỢ' : 'SỐ TIỀN PHẢI THU'}
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                  
                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100 p-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">Chi tiết chứng từ</h4>
                      <div className="space-y-2">
                        {paginatedDocs.map(doc => {
                          const docDiff = doc.totalAmount - doc.deposit;
                          
                          let docDebtDisplay = 0;
                          let docDebtLabel = "";
                          let docDebtColor = "";
                          
                          if (d.type === 'CUSTOMER') {
                            if (docDiff > 0) {
                              docDebtDisplay = docDiff;
                              docDebtLabel = "Cần thu";
                              docDebtColor = "text-emerald-600";
                            } else {
                              docDebtDisplay = Math.abs(docDiff);
                              docDebtLabel = "Khách dư (Nợ khách)";
                              docDebtColor = "text-red-600";
                            }
                          } else {
                            if (docDiff > 0) {
                              docDebtDisplay = docDiff;
                              docDebtLabel = "Cần trả";
                              docDebtColor = "text-red-600";
                            } else {
                              docDebtDisplay = Math.abs(docDiff);
                              docDebtLabel = "Trả dư (Cần thu lại)";
                              docDebtColor = "text-emerald-600";
                            }
                          }

                          return (
                            <div key={doc.id} className="flex flex-col bg-white p-3 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                  <FileText className={`w-5 h-5 ${d.type === 'CUSTOMER' ? 'text-indigo-500' : 'text-amber-500'}`} />
                                  <div>
                                    <button 
                                      onClick={() => navigateToDocument(doc, d.type)}
                                      className="font-bold text-sm text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1 text-left"
                                    >
                                      {doc.documentCode}
                                    </button>
                                    <div className="text-[10px] text-slate-500">{new Date(doc.createdAt).toLocaleString('vi-VN')}</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-4 sm:gap-6">
                                  <div className="text-right">
                                    <div className="text-xs font-bold text-slate-700">{formatCurrency(doc.totalAmount)}</div>
                                    <div className="text-[9px] text-slate-400">Tổng tiền</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs font-bold text-slate-500">{formatCurrency(doc.deposit)}</div>
                                    <div className="text-[9px] text-slate-400">Đã thanh toán</div>
                                  </div>
                                  <div className="text-right min-w-[100px]">
                                    <div className={`text-sm font-bold ${docDebtColor}`}>{formatCurrency(docDebtDisplay)}</div>
                                    <div className="text-[9px] text-slate-400">{docDebtLabel}</div>
                                  </div>
                                </div>
                              </div>

                              {doc.depositsList && doc.depositsList.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Lịch sử thanh toán</p>
                                  <div className="space-y-1.5">
                                    {doc.depositsList.map(dep => (
                                      <div key={dep.id} className="flex items-center justify-between text-xs bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                                        <div className="text-slate-500 flex items-center gap-2">
                                          <span>{new Date(dep.createdAt).toLocaleString('vi-VN')}</span>
                                          <span className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[9px] font-bold">
                                            {dep.paymentMethod === 'TM' ? 'Tiền mặt' : 'Chuyển khoản'}
                                          </span>
                                        </div>
                                        <div className="font-bold text-slate-700">{formatCurrency(dep.amount)}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Document Pagination */}
                      {totalDocPages > 1 && (
                        <div className="flex items-center justify-between mt-4 border-t border-slate-200 pt-3 px-2">
                          <span className="text-xs text-slate-500">
                            Trang {docPage} / {totalDocPages}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setDocPage(prev => Math.max(prev - 1, 1))}
                              disabled={docPage === 1}
                              className="p-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDocPage(prev => Math.min(prev + 1, totalDocPages))}
                              disabled={docPage === totalDocPages}
                              className="p-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-lg shadow-sm">
          <div className="text-sm text-slate-500">
            Hiển thị <span className="font-semibold text-slate-700">{paginatedData.length}</span> đối tác trên trang này
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Trước
            </button>
            <span className="flex items-center px-3 text-sm font-medium text-slate-600">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Sau
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
