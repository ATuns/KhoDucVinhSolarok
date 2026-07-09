import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext.tsx';
import { WarehouseTab } from './components/WarehouseTab.tsx';
import { PendingTab } from './components/PendingTab.tsx';
import { InvoicesTab } from './components/InvoicesTab.tsx';
import { CustomersTab } from './components/CustomersTab.tsx';
import { BankAccountsTab } from './components/BankAccountsTab.tsx';
import { ReportTab } from './components/ReportTab.tsx';
import { PurchaseInvoicesTab } from './components/PurchaseInvoicesTab.tsx';
import { DebtTab } from './components/DebtTab.tsx';
import { 
  Layers, Users, FileBarChart2, 
  LogOut, Sun, ShieldAlert, RefreshCw, LogIn, ChevronRight, Sliders, Settings,
  ListOrdered, FileStack, CreditCard, Landmark, Menu, X, ClipboardList
} from 'lucide-react';

function DashboardContent() {
  const { user, logout, fetchWithAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'invoices' | 'purchase_invoices' | 'warehouse' | 'customers' | 'debts' | 'bank_accounts' | 'reports'>('pending');
  
  // Shared triggers for real-time tab updates
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Danger zone (wipe all data) states
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipePassword, setWipePassword] = useState('');
  const [wipeError, setWipeError] = useState('');
  const [wipeLoading, setWipeLoading] = useState(false);

  const incrementTrigger = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Fetch pending count regularly for navigation badge
  const updatePendingCount = async () => {
    try {
      const res = await fetchWithAuth('/api/invoices?isRecorded=false');
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch pending count:", err);
    }
  };

  useEffect(() => {
    updatePendingCount();
  }, [refreshTrigger, activeTab]);

  useEffect(() => {
    const handleOpenDoc = (e: any) => {
      const { docNumber, type } = e.detail;
      if (type === 'invoice') {
        setActiveTab('invoices');
      } else if (type === 'purchase') {
        setActiveTab('purchase_invoices');
      }
      setTimeout(() => {
        window.location.hash = `#doc=${docNumber}`;
      }, 100);
    };
    window.addEventListener('OPEN_DOC', handleOpenDoc);
    return () => window.removeEventListener('OPEN_DOC', handleOpenDoc);
  }, []);

  // Keyboard shortcut listener for Ctrl + x + 1
  useEffect(() => {
    const activeKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      activeKeys.add(e.key.toLowerCase());
      
      const isCtrl = e.ctrlKey || activeKeys.has('control');
      const isX = activeKeys.has('x');
      const isOne = activeKeys.has('1');

      if (isCtrl && isX && isOne) {
        e.preventDefault();
        setShowWipeModal(true);
        activeKeys.clear();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.delete(e.key.toLowerCase());
    };

    const handleBlur = () => {
      activeKeys.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleWipeData = async () => {
    setWipeError('');
    if (wipePassword !== "atuan0987231270") {
      setWipeError("Mật khẩu không chính xác. Vui lòng nhập lại!");
      return;
    }
    
    setWipeLoading(true);
    try {
      const res = await fetchWithAuth('/api/danger/wipe-all-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: wipePassword })
      });
      
      if (res.ok) {
        alert("Đã xóa sạch toàn bộ dữ liệu hệ thống thành công!");
        setShowWipeModal(false);
        setWipePassword('');
        // Reload page to refresh all lists & state
        window.location.reload();
      } else {
        const errData = await res.json();
        setWipeError(errData.error || "Không thể xóa dữ liệu hệ thống");
      }
    } catch (err) {
      console.error(err);
      setWipeError("Đã xảy ra lỗi kết nối mạng");
    } finally {
      setWipeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans selection:bg-indigo-500 selection:text-white relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      {/* Left Sidebar Menu */}
      <aside className={`fixed inset-y-0 left-0 w-[200px] bg-white border-r border-slate-200 z-50 flex flex-col transition-transform duration-300 ease-in-out md:static md:h-screen md:sticky md:top-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-150 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg text-amber-400 flex items-center justify-center shadow-xs">
              <Sun className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <span className="font-display font-black text-slate-950 text-sm uppercase tracking-tight leading-none block">Đức Vinh Solar</span>
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mt-1 block">Quản Lý Kho & Bán Hàng</span>
            </div>
          </div>
          
          {/* Close button on mobile */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Menu - Vertical */}
        <div className="flex-1 overflow-y-auto p-3">
          <nav className="flex flex-col space-y-1">
            <button
              id="tab_pending"
              onClick={() => {
                setActiveTab('pending');
                setIsSidebarOpen(false);
              }}
              className={`flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'pending' 
                  ? 'bg-amber-50 text-amber-800 shadow-2xs border border-amber-100/30' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                <span>Trang Chờ</span>
              </div>
              {pendingCount > 0 && (
                <span className="bg-amber-150 text-amber-900 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              id="tab_invoices"
              onClick={() => {
                setActiveTab('invoices');
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'invoices' 
                  ? 'bg-emerald-50 text-emerald-700 shadow-2xs border border-emerald-100/30' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <FileBarChart2 className="w-4 h-4 text-emerald-500" />
              <span>Sổ Hóa Đơn</span>
            </button>

            <button
              id="tab_purchase_invoices"
              onClick={() => {
                setActiveTab('purchase_invoices');
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'purchase_invoices' 
                  ? 'bg-blue-50 text-blue-700 shadow-2xs border border-blue-100/30' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <FileStack className="w-4 h-4 text-blue-500" />
              <span>Sổ Phiếu Nhập</span>
            </button>

            <button
              id="tab_warehouse"
              onClick={() => {
                setActiveTab('warehouse');
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'warehouse' 
                  ? 'bg-cyan-50 text-cyan-700 shadow-2xs border border-cyan-100/30' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <Layers className="w-4 h-4 text-cyan-500" />
              <span>Kho Vật Tư</span>
            </button>

            <button
              id="tab_customers"
              onClick={() => {
                setActiveTab('customers');
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'customers' 
                  ? 'bg-indigo-50 text-indigo-700 shadow-2xs border border-indigo-100/30' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-500" />
              <span>Đối Tác</span>
            </button>

            <button
              id="tab_debts"
              onClick={() => {
                setActiveTab('debts');
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'debts' 
                  ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-100/30' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <CreditCard className="w-4 h-4 text-rose-500" />
              <span>Công Nợ</span>
            </button>

            <button
              id="tab_bank_accounts"
              onClick={() => {
                setActiveTab('bank_accounts');
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'bank_accounts' 
                  ? 'bg-sky-50 text-sky-700 shadow-2xs border border-sky-100/30' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <Landmark className="w-4 h-4 text-sky-500" />
              <span>TK Ngân Hàng</span>
            </button>

            <button
              id="tab_reports"
              onClick={() => {
                setActiveTab('reports');
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'reports' 
                  ? 'bg-slate-100 text-slate-800 shadow-2xs border border-slate-200/30' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Báo Cáo & Cấu Hình</span>
            </button>
          </nav>
        </div>

        {/* User Profile & Logout - Bottom of Sidebar */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-1 bg-slate-50 mt-auto">
          <div className="flex items-center gap-2 text-xs min-w-0">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                className="w-8 h-8 rounded-full border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="text-left min-w-0">
              <div className="font-bold text-slate-800 truncate text-[11px] leading-tight">{user?.displayName || user?.email?.split('@')[0]}</div>
              <div className="text-slate-400 font-mono text-[9px] truncate leading-tight">{user?.email}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </aside>

      {/* Main Container including Mobile Header & Content area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        
        {/* Mobile Top Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-35 flex items-center justify-between px-4 h-12 md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-indigo-600 rounded text-amber-400">
                <Sun className="w-3.5 h-3.5 animate-spin-slow" />
              </div>
              <span className="font-display font-black text-slate-950 text-sm uppercase tracking-tight">Đức Vinh Solar</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.photoURL && (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                className="w-6.5 h-6.5 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
            )}
            <button
              onClick={logout}
              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

      {/* Main Workspace - Padding reduced to py-4 (High Density) */}
      <main className="flex-1 w-full px-4 py-4">
        {activeTab === 'purchase_invoices' && (
          <PurchaseInvoicesTab 
            refreshTrigger={refreshTrigger} 
            onPurchaseOrderModified={incrementTrigger} 
          />
        )}
        
        {activeTab === 'pending' && (
          <PendingTab 
            refreshTrigger={refreshTrigger} 
            onRecordedSuccess={incrementTrigger} 
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab 
            refreshTrigger={refreshTrigger} 
            onInvoiceModified={incrementTrigger} 
          />
        )}

        {activeTab === 'warehouse' && (
          <WarehouseTab />
        )}

        {activeTab === 'customers' && (
          <CustomersTab />
        )}

        {activeTab === 'debts' && (
          <DebtTab refreshTrigger={refreshTrigger} />
        )}

        {activeTab === 'bank_accounts' && (
          <BankAccountsTab />
        )}

        {activeTab === 'reports' && (
          <ReportTab />
        )}
      </main>

      {/* Corporate Footer - Highly compact */}
      <footer className="bg-white border-t border-slate-200 mt-4 py-2 text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
        <span>Đức Vinh Solar © 2026 • CÔNG TY TNHH DỊCH VỤ VIỄN THÔNG ĐỨC VINH • MST: 0311193770</span>
      </footer>

      {showWipeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-rose-100 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center gap-3">
              <div className="p-2 bg-rose-500 rounded-lg text-white">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-rose-950 uppercase tracking-tight text-sm">Cảnh báo nguy hiểm</h3>
                <p className="text-[10px] text-rose-600 font-semibold uppercase tracking-wider">Xóa toàn bộ dữ liệu hệ thống</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Hành động này sẽ <strong className="text-rose-600">xóa vĩnh viễn</strong> toàn bộ dữ liệu trên hệ thống bao gồm:
              </p>
              
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium">
                <li>Tất cả Khách hàng</li>
                <li>Tất cả Nhà cung cấp</li>
                <li>Tất cả Sản phẩm & Tồn kho</li>
                <li>Tất cả Hóa đơn & Chứng từ</li>
                <li>Tất cả Lịch sử giao dịch & Công nợ</li>
              </ul>
              
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Nhập mật khẩu xác nhận
                </label>
                <input
                  type="password"
                  value={wipePassword}
                  onChange={(e) => {
                    setWipePassword(e.target.value);
                    setWipeError('');
                  }}
                  placeholder="•••••••••••••••"
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl text-xs font-mono transition-all outline-hidden text-slate-900 shadow-inner"
                />
                {wipeError && (
                  <p className="text-[10px] font-bold text-rose-600 animate-pulse">{wipeError}</p>
                )}
              </div>
            </div>
            
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowWipeModal(false);
                  setWipePassword('');
                  setWipeError('');
                }}
                disabled={wipeLoading}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleWipeData}
                disabled={wipeLoading || !wipePassword}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {wipeLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>XÓA TOÀN BỘ DỮ LIỆU</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

function LoginScreen() {
  const { signInWithPassword, loading } = useAuth();
  const [securityCode, setSecurityCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLoginClick = async () => {
    if (!securityCode) {
      setErrorMsg('Vui lòng nhập mã bảo mật!');
      return;
    }
    setErrorMsg('');
    try {
      await signInWithPassword(securityCode);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi đăng nhập');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      
      {/* Decorative backdrop glow */}
      <div className="absolute w-[300px] h-[300px] bg-indigo-500/10 blur-[100px] rounded-full top-1/4"></div>
      <div className="absolute w-[200px] h-[200px] bg-amber-500/10 blur-[100px] rounded-full bottom-1/4"></div>

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 text-center z-10">
        
        {/* Animated Sun Logo */}
        <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl flex items-center justify-center text-amber-400 shadow-xl border border-indigo-400/20">
          <Sun className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-1">
          <h1 className="font-display font-black text-white text-2xl uppercase tracking-tight">Đức Vinh Solar</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none">Hệ thống kho & bán hàng</p>
        </div>

        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-left text-[11px] text-slate-400 space-y-2">
          <div className="font-bold text-indigo-400 border-b border-slate-800/50 pb-1 uppercase tracking-wider">CÔNG TY TNHH DỊCH VỤ VIỄN THÔNG ĐỨC VINH</div>
          <p>• <b>Mã số thuế:</b> <span className="font-mono text-slate-300">0311193770</span></p>
          <p>• <b>Địa chỉ:</b> <span className="text-slate-300">137 Đường Thới Tam Thôn 9, Xã Đông Thạnh, TP. Hồ Chí Minh, Việt Nam</span></p>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <input
              type="password"
              placeholder="Nhập mã bảo mật để tiếp tục..."
              value={securityCode}
              onChange={(e) => {
                setSecurityCode(e.target.value);
                setErrorMsg('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLoginClick();
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            {errorMsg && (
              <p className="text-red-400 text-xs font-semibold text-left mt-2">{errorMsg}</p>
            )}
          </div>

          <button
            onClick={handleLoginClick}
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin text-white" />
            ) : (
              <span className="tracking-wide">ĐĂNG NHẬP HỆ THỐNG</span>
            )}
          </button>
          
          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
            Hệ thống dùng chung bảo mật cao. Vui lòng sử dụng mã bảo mật do ban quản trị cấp để đăng nhập.
          </p>
        </div>

      </div>
    </div>
  );
}

function MainAppSelector() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Đang kết nối Cloud SQL...</span>
      </div>
    );
  }

  return user ? <DashboardContent /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppSelector />
    </AuthProvider>
  );
}
