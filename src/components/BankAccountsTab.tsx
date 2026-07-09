import React, { useState } from 'react';
import { useBankAccounts } from './useBankAccounts.ts';
import { Plus, Trash2, Landmark, Check, X } from 'lucide-react';
import { BankAccount } from '../types.ts';

export const BankAccountsTab: React.FC = () => {
  const { bankAccounts, loading, addBankAccount, removeBankAccount, updateBankAccount } = useBankAccounts();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    accountNumber: '',
    bankName: '',
    accountName: '',
    branch: ''
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountNumber || !formData.bankName || !formData.accountName) return;
    try {
      await addBankAccount(formData);
      setShowAdd(false);
      setFormData({ accountNumber: '', bankName: '', accountName: '', branch: '' });
    } catch (e) {
      alert("Lỗi khi thêm tài khoản");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Bạn có chắc chắn muốn xóa tài khoản này?")) {
      try {
        await removeBankAccount(id);
      } catch (e) {
        alert("Lỗi khi xóa tài khoản");
      }
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="w-6 h-6 text-indigo-600" /> Quản Lý Tài Khoản Ngân Hàng
          </h2>
          <p className="text-sm text-slate-500">Thêm và quản lý các tài khoản ngân hàng để nhận thanh toán</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Đóng' : 'Thêm Tài Khoản Mới'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Số Tài Khoản *</label>
            <input type="text" required value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="VD: 0123456789" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tên Ngân Hàng *</label>
            <input type="text" required value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="VD: Vietcombank" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tên Người Nhận *</label>
            <input type="text" required value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="VD: NGUYEN VAN A" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Chi Nhánh</label>
            <input type="text" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="VD: Chi nhánh Ba Đình" />
          </div>
          <div className="md:col-span-2 flex justify-end mt-2">
            <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-2">
              <Check className="w-4 h-4" /> Lưu Tài Khoản
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-500">Đang tải dữ liệu...</div>
      ) : bankAccounts.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-10 text-center">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-600">Chưa có tài khoản ngân hàng</h3>
          <p className="text-sm text-slate-500 mt-1">Vui lòng thêm tài khoản ngân hàng để sử dụng cho tính năng thanh toán Chuyển Khoản.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bankAccounts.map(b => (
            <div key={b.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 flex gap-2">
                <button onClick={() => handleDelete(b.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{b.bankName}</h3>
                  <p className="text-xs text-slate-500">{b.branch || 'Không có chi nhánh'}</p>
                </div>
              </div>
              <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-semibold uppercase">Số TK:</span>
                  <span className="font-mono font-bold text-indigo-700 text-base">{b.accountNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-semibold uppercase">Người Nhận:</span>
                  <span className="font-semibold text-slate-800 uppercase">{b.accountName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
