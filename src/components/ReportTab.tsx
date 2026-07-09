import React, { useState, useRef } from 'react';
import { useAuth } from './AuthContext.tsx';
import { FileSpreadsheet, Download, RefreshCw, Landmark, ShieldCheck, Mail, MapPin, Database, UploadCloud, DownloadCloud } from 'lucide-react';

export const ReportTab: React.FC = () => {
  const { token, fetchWithAuth } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [message, setMessage] = useState<{type: "error" | "success", text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      // Trigger a direct browser file download
      const response = await fetch('/api/reports/excel', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Xuất báo cáo thất bại");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "Bao_cao_Duc_Vinh_Solar.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Không thể tải báo cáo Excel. Vui lòng liên hệ quản trị viên.");
    } finally {
      setDownloading(false);
    }
  };

  const handleExportDatabase = async () => {
    setExporting(true);
    try {
      const response = await fetchWithAuth('/api/database/export');
      if (!response.ok) throw new Error("Xuất dữ liệu thất bại");
      
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `Duc_Vinh_Database_Backup_${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Không thể xuất dữ liệu database. Vui lòng thử lại sau.");
    } finally {
      setExporting(false);
    }
  };

  const handleImportDatabase = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setShowImportModal(true);
    setMessage(null);
    setImportPassword("");
  };

  const confirmImport = async () => {
    if (!importFile || !importPassword) {
      setMessage({ type: 'error', text: 'Vui lòng nhập mật khẩu.' });
      return;
    }

    setImporting(true);
    setMessage(null);
    try {
      const fileText = await importFile.text();
      const jsonData = JSON.parse(fileText);

      const response = await fetchWithAuth('/api/database/import', {
        method: 'POST',
        body: JSON.stringify({
          password: importPassword,
          data: jsonData
        })
      });

      if (!response.ok) {
        let errorMessage = "Nhập dữ liệu thất bại";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch(e) {
          errorMessage = `Lỗi hệ thống: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      setMessage({ type: 'success', text: "Nhập dữ liệu thành công! Hệ thống sẽ tải lại..." });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: `Lỗi: ${error.message}` });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cancelImport = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportPassword("");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div id="reports_container" className="space-y-3">
      
      {/* Title */}
      <div>
        <h1 className="font-display text-base font-bold tracking-tight text-slate-900">Báo Cáo & Cấu Hình</h1>
        <p className="text-xs text-slate-500">Xuất dữ liệu Excel định kỳ, thông tin doanh nghiệp</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        
        {/* Company Profile Card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-3">
          <h3 className="font-display font-bold text-slate-800 text-sm border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
            <Landmark className="w-4 h-4 text-indigo-600" />
            <span>Thông Tin Doanh Nghiệp</span>
          </h3>
          
          <div className="space-y-2.5 text-xs text-slate-600">
            <div>
              <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">Tên công ty</span>
              <p className="text-xs font-bold text-slate-900 mt-0.5">CÔNG TY TRÁCH NHIỆM HỮU HẠN DỊCH VỤ VIỄN THÔNG ĐỨC VINH</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">Thương hiệu</span>
                <p className="text-xs font-extrabold text-indigo-600 mt-0.5">ĐỨC VINH SOLAR</p>
              </div>

              <div>
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">Mã số thuế</span>
                <p className="font-mono text-xs font-semibold text-slate-800 mt-0.5">0311193770</p>
              </div>
            </div>

            <div>
              <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">Trụ sở chính</span>
              <p className="text-slate-800 font-medium leading-normal mt-0.5 flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>137 Đường Thới Tam Thôn 9, Xã Đông Thạnh, Thành phố Hồ Chí Minh, Việt Nam</span>
              </p>
            </div>

            <div className="pt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 p-2 rounded-md border border-emerald-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Cơ sở dữ liệu được mã hóa và lưu giữ trên Google Cloud SQL</span>
            </div>
          </div>
        </div>

        {/* Regular Reports Card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="font-display font-bold text-slate-800 text-sm border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Báo Cáo Định Kỳ Excel</span>
            </h3>
            
            <p className="text-[11px] text-slate-500 leading-normal">
              Hệ thống hỗ trợ xuất báo cáo tổng hợp nhanh chóng dưới dạng file <b>Excel (.xlsx)</b>. File tải về bao gồm hai bảng tính trực quan được phân chia rõ ràng:
            </p>

            <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4 leading-normal">
              <li><b>Danh sách vật tư:</b> Toàn bộ thông tin vật tư, số lượng tồn kho thực tế, giá bán mặc định, kèm theo cảnh báo tự động khi mặt hàng vượt ngưỡng tồn tối thiểu.</li>
              <li><b>Danh sách hóa đơn:</b> Lịch sử hóa đơn, tình trạng thanh toán (Tiền mặt, Chuyển khoản, Chưa thanh toán), giá trị giao dịch, ngày lập chi tiết.</li>
            </ul>
          </div>

          <button
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded transition-all flex items-center justify-center gap-1.5 mt-2"
          >
            {downloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Tải Báo Cáo Excel Ngay (.xlsx)</span>
          </button>
        </div>

        {/* Database Management Card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-3 flex flex-col justify-between md:col-span-2">
          <div className="space-y-2">
            <h3 className="font-display font-bold text-slate-800 text-sm border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Quản Lý Dữ Liệu (Sao Lưu & Phục Hồi)</span>
            </h3>
            
            <p className="text-[11px] text-slate-500 leading-normal">
              Xuất toàn bộ cơ sở dữ liệu hiện tại (bao gồm danh mục, hóa đơn, tồn kho) thành một file JSON duy nhất để lưu trữ, hoặc khôi phục lại dữ liệu từ file đã sao lưu.
            </p>
            <div className="pt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-rose-700 bg-rose-50 p-2 rounded-md border border-rose-100">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>CẢNH BÁO: Phục hồi dữ liệu sẽ ghi đè và xóa toàn bộ dữ liệu hiện tại! Cần mật khẩu Admin để xác nhận.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={handleExportDatabase}
              disabled={exporting || importing}
              className="w-full py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded transition-all flex flex-col items-center justify-center gap-1"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <DownloadCloud className="w-4 h-4" />
              )}
              <span>Sao Lưu (Export)</span>
            </button>
            
            <div className="relative w-full h-full">
              <input 
                type="file" 
                accept=".json"
                ref={fileInputRef}
                onChange={handleImportDatabase}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                id="import-db-input"
                title="Chọn file backup JSON"
              />
              <div
                className={`w-full h-full py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded transition-all flex flex-col items-center justify-center gap-1 ${importing || exporting ? "opacity-50 pointer-events-none" : ""}`}
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>Phục Hồi (Import)</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-rose-50/50">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Xác nhận phục hồi</h3>
                <p className="text-[11px] text-slate-500">Tất cả dữ liệu cũ sẽ bị xóa bỏ</p>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {message && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Mật khẩu Admin</label>
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Nhập mật khẩu để tiếp tục..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Bạn đang chọn file: <span className="font-bold text-slate-700">{importFile?.name}</span>
              </p>
            </div>
            
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button
                onClick={cancelImport}
                disabled={importing}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmImport}
                disabled={importing}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>Thực hiện</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
