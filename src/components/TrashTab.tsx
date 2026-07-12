import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Trash2, Calendar as CalendarIcon, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';

export const TrashTab: React.FC = () => {
  const { fetchWithAuth } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'purchase_orders'>('invoices');
    const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: number, docType: string} | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'invoices') {
        const invRes = await fetchWithAuth(`/api/invoices?isDeleted=true&page=${currentPage}`);
        if (invRes.ok) {
          const data = await invRes.json();
          setInvoices(data.invoices || []);
          setTotalPages(data.totalPages || 1);
        }
      } else {
        const poRes = await fetchWithAuth(`/api/purchase-orders?isDeleted=true&page=${currentPage}`);
        if (poRes.ok) {
          const data = await poRes.json();
          setPurchaseOrders(data.purchaseOrders || []);
          setTotalPages(data.totalPages || 1);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

   useEffect(() => {
    fetchTrash();
  }, [activeSubTab, currentPage]);

  const handleRestore = async (id: number, type: 'invoices' | 'purchase-orders') => {
    try {
      const res = await fetchWithAuth(`/api/${type}/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        fetchTrash();
      } else {
        const data = await res.json();
        alert(data.error || "Khôi phục thất bại");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối");
    }
  };

  const confirmPermanentDelete = (id: number, type: string) => {
    setItemToDelete({ id, docType: type });
    setShowConfirm(true);
  };

  const executePermanentDelete = async () => {
    if (!itemToDelete) return;
    try {
      const { id, docType } = itemToDelete;
      const res = await fetchWithAuth(`/api/${docType}/${id}/permanent`, { method: 'DELETE' });
      if (res.ok) {
        fetchTrash();
      } else {
        const data = await res.json();
        alert(data.error || "Xóa thất bại");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối");
    } finally {
      setShowConfirm(false);
      setItemToDelete(null);
    }
  };

  const handleViewDetails = async (id: number, type: string) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const res = await fetchWithAuth(`/api/${type}/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      } else {
        alert("Lỗi tải chi tiết");
        setShowDetailModal(false);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối");
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const dataList = activeSubTab === 'invoices' ? invoices : purchaseOrders;
  const apiPath = activeSubTab === 'invoices' ? 'invoices' : 'purchase-orders';

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-xs border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-rose-500" />
            Thùng Rác
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">Danh sách chứng từ đã bị xóa tạm thời.</p>
        </div>
      </div>

    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => { setActiveSubTab('invoices'); setCurrentPage(1); }}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeSubTab === 'invoices' ? 'bg-slate-50 text-emerald-700 border-b-2 border-emerald-500' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            Hóa Đơn ({invoices.length})
          </button>
          <button
            onClick={() => { setActiveSubTab('purchase_orders'); setCurrentPage(1); }}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeSubTab === 'purchase_orders' ? 'bg-slate-50 text-blue-700 border-b-2 border-blue-500' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            Phiếu Nhập ({purchaseOrders.length})
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-10 text-xs font-semibold text-slate-500 animate-pulse">Đang tải...</div>
          ) : dataList.length === 0 ? (
            <div className="text-center py-10 text-xs font-semibold text-slate-400">Thùng rác trống.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Mã Chứng Từ</th>
                    <th className="px-4 py-3">Ngày Xóa</th>
                    <th className="px-4 py-3 text-right">Tổng Tiền</th>
                    <th className="px-4 py-3 text-center rounded-tr-lg">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataList.map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <button 
                          onClick={() => handleViewDetails(doc.id, apiPath)}
                          className="hover:text-indigo-600 hover:underline transition-colors text-left"
                        >
                          {doc.documentCode}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {doc.deletedAt ? new Date(doc.deletedAt).toLocaleString('vi-VN') : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {doc.totalAmount?.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="px-4 py-3 text-center space-x-2">
                        <button
                          onClick={() => handleRestore(doc.id, apiPath)}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-bold transition-colors"
                          title="Khôi phục"
                        >
                          <RotateCcw className="w-4 h-4 inline-block" />
                        </button>
                        <button
                          onClick={() => confirmPermanentDelete(doc.id, apiPath)}
                          className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-bold transition-colors"
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 className="w-4 h-4 inline-block" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
   {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 bg-white p-3 rounded-b-xl">
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
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-rose-50">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Xác nhận xóa vĩnh viễn</h3>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-600 leading-relaxed text-center">
                Bạn có chắc chắn muốn xóa vĩnh viễn chứng từ này không? Hành động này <strong className="text-rose-600">không thể hoàn tác</strong>.
              </p>
            </div>
            
            <div className="p-4 bg-slate-50 flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={executePermanentDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-slate-800 text-lg">
                  Chi Tiết Chứng Từ Đã Xóa
                </h3>
                {detailData && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mã: {detailData.documentCode || detailData.invoiceNumber || detailData.poNumber}
                  </p>
                )}
              </div>
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailData(null);
                }} 
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="text-center py-10 text-slate-500 text-sm">Đang tải chi tiết...</div>
              ) : detailData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div>
                      <div className="text-slate-500 font-medium">Khách hàng / Đối tác:</div>
                      <div className="font-bold text-slate-800">{detailData.customerName || detailData.supplierName || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-medium">Trạng thái:</div>
                      <div className="font-bold text-slate-800">{detailData.status}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-medium">Tổng tiền:</div>
                      <div className="font-bold text-rose-600">{detailData.totalAmount?.toLocaleString('vi-VN')} đ</div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-medium">Ngày tạo:</div>
                      <div className="font-bold text-slate-800">{detailData.createdAt ? new Date(detailData.createdAt).toLocaleString('vi-VN') : 'N/A'}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">Chi tiết hàng hóa</h4>
                    {detailData.items && detailData.items.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="p-2 border-b">Tên Hàng</th>
                              <th className="p-2 border-b text-right">SL</th>
                              <th className="p-2 border-b text-right">Đơn Giá</th>
                              <th className="p-2 border-b text-right">Thành Tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.items.map((itm: any, idx: number) => (
                              <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                                <td className="p-2 font-medium">{itm.productName || itm.name}</td>
                                <td className="p-2 text-right">{itm.quantity}</td>
                                <td className="p-2 text-right">{itm.price?.toLocaleString('vi-VN')}</td>
                                <td className="p-2 text-right font-bold">{(itm.quantity * itm.price)?.toLocaleString('vi-VN')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic text-sm">Không có sản phẩm nào.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
               <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailData(null);
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
