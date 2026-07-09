import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Warehouse } from '../types.ts';
import { Plus, Edit2, Trash2, Home, Search, AlertTriangle, ArrowRight, Building2, MapPin, AlignLeft, RefreshCw } from 'lucide-react';
import { searchMatch } from '../utils.ts';

interface Props {
  onSelectWarehouse: (warehouse: Warehouse) => void;
}

export const WarehouseManager: React.FC<Props> = ({ onSelectWarehouse }) => {
  const { fetchWithAuth } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/warehouses');
      if (!res.ok) throw new Error("Không thể tải danh sách kho");
      setWarehouses(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const url = editId ? `/api/warehouses/${editId}` : '/api/warehouses';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({ code: code.trim(), name: name.trim(), address: address.trim(), note: note.trim() })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Lỗi lưu kho");
      }
      setShowModal(false);
      fetchWarehouses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa kho này? Toàn bộ sản phẩm trong kho sẽ bị ảnh hưởng.")) return;
    try {
      const res = await fetchWithAuth(`/api/warehouses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Lỗi xóa kho");
      fetchWarehouses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openAdd = () => {
    setEditId(null); setCode(''); setName(''); setAddress(''); setNote(''); setShowModal(true); setError('');
  };

  const openEdit = (w: Warehouse) => {
    setEditId(w.id); setCode(w.code || ''); setName(w.name || ''); setAddress(w.address || ''); setNote(w.note || ''); setShowModal(true); setError('');
  };

  const filtered = warehouses.filter(w => 
    searchMatch(w.name, searchTerm) || 
    (w.code && searchMatch(w.code, searchTerm))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">Quản Lý Danh Sách Kho</h1>
          <p className="text-sm text-slate-500">Vui lòng chọn một kho để làm việc hoặc tạo mới kho vật tư</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Kho Mới</span>
        </button>
      </div>

      {error && !showModal && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4">
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã kho hoặc tên kho..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-indigo-500" />
            <p>Đang tải danh sách kho...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-medium">Chưa có kho nào hoặc không tìm thấy.</p>
            <p className="text-xs mt-1">Vui lòng thêm kho vật tư mới để bắt đầu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(w => (
              <div key={w.id} className="group flex flex-col bg-white border border-slate-200 hover:border-indigo-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div 
                  className="p-5 flex-1 cursor-pointer flex flex-col items-start"
                  onClick={() => onSelectWarehouse(w)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold font-mono rounded">
                      {w.code}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {w.name}
                  </h3>
                  
                  {w.address && (
                    <div className="flex items-start gap-1.5 mt-3 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2">{w.address}</span>
                    </div>
                  )}
                  {w.note && (
                    <div className="flex items-start gap-1.5 mt-2 text-sm text-slate-500">
                      <AlignLeft className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2 italic">{w.note}</span>
                    </div>
                  )}
                </div>
                
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => onSelectWarehouse(w)}
                    className="text-sm font-semibold text-indigo-600 flex items-center gap-1 hover:text-indigo-800"
                  >
                    Vào kho <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(w)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Sửa kho">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">
                {editId ? 'Sửa Thông Tin Kho' : 'Thêm Kho Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && (
                <div className="p-2 bg-red-50 text-red-600 text-sm rounded border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Mã Kho <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ví dụ: KHO-HCM-01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên Kho <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Kho Tổng Tân Bình"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Địa Chỉ</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ví dụ: 123 Đường A, Quận B..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi Chú</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thêm về kho này..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none h-20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg">
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">
                  Lưu Thông Tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
