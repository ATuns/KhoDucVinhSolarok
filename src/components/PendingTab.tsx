import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Invoice, formatVND } from '../types.ts';
import { 
  CheckCircle2, AlertTriangle, RefreshCw, FileText, Trash2, 
  ArrowRight, Users, Calendar, Coins, CheckSquare, Square 
} from 'lucide-react';

export const PendingTab: React.FC<{ refreshTrigger: number; onRecordedSuccess: () => void }> = ({ refreshTrigger, onRecordedSuccess }) => {
  const { fetchWithAuth } = useAuth();
  const [pendingList, setPendingList] = useState<Invoice[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Batch selections
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);

  const loadPendingInvoices = async () => {
       setLoading(true);
    try {
      // Load all unrecorded invoices (isRecorded = false)
      const res = await fetchWithAuth(`/api/invoices?isRecorded=false&page=${currentPage}`);
      if (res.ok) {
        const data = await res.json();
        setPendingList(data.invoices || []);
        setTotalPages(data.totalPages || 1);
      } else {
        throw new Error("Không thể tải danh sách hóa đơn chờ");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingInvoices();
  }, [refreshTrigger, currentPage]);

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingList.map(item => item.id));
    }
  };

  // Record/Ghi sổ individual invoice
  const handleRecordInvoice = async (id: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetchWithAuth(`/api/invoices/${id}/record`, {
        method: 'POST'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ghi sổ thất bại");
      }

      const result = await res.json();
      setSuccessMsg(result.message || "Ghi sổ thành công!");
      setSelectedIds(selectedIds.filter(x => x !== id));
      loadPendingInvoices();
      onRecordedSuccess();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Batch Record/Ghi sổ multiple selected invoices
  const handleBatchRecord = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (selectedIds.length === 0) return;

    let successCount = 0;
    let failedMsgs: string[] = [];

    setLoading(true);
    for (const id of selectedIds) {
      try {
        const res = await fetchWithAuth(`/api/invoices/${id}/record`, {
          method: 'POST'
        });
        if (res.ok) {
          successCount++;
        } else {
          const errData = await res.json();
          const targetInv = pendingList.find(x => x.id === id);
          failedMsgs.push(`Hóa đơn ${targetInv?.invoiceNumber || id}: ${errData.error}`);
        }
      } catch (err: any) {
        failedMsgs.push(`Hóa đơn ID ${id}: Lỗi mạng`);
      }
    }

    if (successCount > 0) {
      setSuccessMsg(`Ghi sổ thành công ${successCount} hóa đơn! Hàng hóa đã được tự động xuất kho.`);
    }
    if (failedMsgs.length > 0) {
      setErrorMsg(`Ghi sổ thất bại cho các hóa đơn sau:\n` + failedMsgs.join('\n'));
    }

    setSelectedIds([]);
    loadPendingInvoices();
    onRecordedSuccess();
  };

  // Delete draft invoice from Pending Bill Tab
  const handleDeleteDraft = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      message: "Bạn có chắc muốn xóa hóa đơn tạm này không?",
      onConfirm: async () => {
        setConfirmDialog(null);
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await fetchWithAuth(`/api/invoices/${id}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            setSuccessMsg("Đã xóa hóa đơn tạm.");
            setSelectedIds(selectedIds.filter(x => x !== id));
            loadPendingInvoices();
          } else {
            const errData = await res.json();
            throw new Error(errData.error || "Xóa thất bại");
          }
        } catch (err: any) {
          setErrorMsg(err.message);
        }
      }
    });
  };

  return (
    <div id="pending_container" className="space-y-3">
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
            <span>Trang Chờ Xác Nhận</span>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              {pendingList.length} hóa đơn tạm
            </span>
          </h1>
          <p className="text-xs text-slate-500">Danh sách các hóa đơn bán hàng tạm thời chưa trừ kho vật tư.</p>
        </div>

        {selectedIds.length > 0 && (
          <button
            onClick={handleBatchRecord}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-xs transition-all self-start md:self-auto"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Xác nhận Ghi Sổ ({selectedIds.length}) Đơn Đã Chọn</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-start gap-1.5 whitespace-pre-line">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-start gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <div>{successMsg}</div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-8 text-center text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-500" />
          <span className="text-xs font-semibold">Đang tải danh sách chờ xác nhận...</span>
        </div>
      ) : pendingList.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-400">
          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-bold text-slate-600 text-sm">Trang chờ rỗng</h3>
          <p className="text-xs text-slate-400 mt-1">Tất cả các hóa đơn bán hàng đều đã được Ghi sổ hoặc chưa có đơn hàng nháp nào.</p>
        </div>
      ) : (
        <div className="space-y-2">
          
          {/* Header select-all bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-2 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <button onClick={toggleSelectAll} className="flex items-center gap-1.5 hover:text-slate-800">
              {selectedIds.length === pendingList.length ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Chọn tất cả ({pendingList.length})</span>
            </button>
            <span>Tác vụ hàng loạt</span>
          </div>

          {/* List of unrecorded invoices */}
          <div className="grid grid-cols-1 gap-2">
            {pendingList.map((inv) => (
              <div 
                key={inv.id}
                className={`bg-white rounded-lg border p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all hover:shadow-xs ${
                  selectedIds.includes(inv.id) ? 'border-indigo-400 bg-indigo-50/10' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button 
                    onClick={() => toggleSelect(inv.id)} 
                    className="mt-1 focus:outline-none"
                  >
                    {selectedIds.includes(inv.id) ? (
                      <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-300 hover:text-indigo-400" />
                    )}
                  </button>

                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-display font-bold text-slate-900 text-sm">{inv.invoiceNumber}</span>
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">({inv.documentCode})</span>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                        Chưa ghi sổ (Chờ)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-0.5 gap-x-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>Khách hàng: <b>{inv.customerName || 'Khách vãng lai'}</b></span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Ngày tạo: <b>{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('vi-VN') : ''}</b></span>
                      </span>
                      {inv.depositEnabled && (
                        <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-1 rounded border border-amber-100 text-[10px]">
                          <Coins className="w-3 h-3" />
                          <span>Có đặt cọc</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side actions & pricing */}
                <div className="flex items-center justify-between md:justify-end gap-3 border-t border-slate-100 md:border-0 pt-2 md:pt-0">
                  <div className="text-left md:text-right">
                    <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Tổng tiền</div>
                    <div className="font-mono font-bold text-sm text-slate-900">
                      {formatVND(inv.totalAmount)} đ
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDeleteDraft(inv.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Xóa đơn hàng tạm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleRecordInvoice(inv.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md shadow-xs transition-colors"
                    >
                      <span>Ghi Sổ & Xuất Kho</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}
     
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 bg-white p-3 rounded-xl shadow-xs">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Trang trước
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Trang sau
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Trang <span className="font-semibold">{currentPage}</span> / <span className="font-semibold">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      {/* Confirm Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">Xác nhận</h3>
                <p className="text-sm text-slate-500">{confirmDialog.message}</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  className="flex-1 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                  onClick={() => setConfirmDialog(null)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                  onClick={confirmDialog.onConfirm}
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
