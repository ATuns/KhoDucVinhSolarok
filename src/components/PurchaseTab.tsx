import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Product, Supplier, formatVND, formatQuantity } from '../types.ts';
import { PriceInput } from './PriceInput.tsx';
import { QuantityInput } from './QuantityInput.tsx';
import { useBankAccounts } from './useBankAccounts.ts';
import { searchMatch } from '../utils.ts';
import {
  Plus, Search, ShoppingBag, X, UserPlus, FileText, CheckCircle2, 
  Trash2, Landmark, AlertCircle, Coins, CoinsIcon, Percent 
} from 'lucide-react';

export const PurchaseTab: React.FC<{ onPurchaseOrderCreated: () => void }> = ({ onPurchaseOrderCreated }) => {
  const { fetchWithAuth } = useAuth();

  // Search results & caching
  const [productsCache, setProductsCache] = useState<Product[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);

  // Selected state
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [saleItems, setSaleItems] = useState<Array<{
    product: Product;
    quantity: number;
    customPrice: number;
    customUnit?: string;
    hasVat?: boolean;
    vatRate?: number;
  }>>([]);

  // Search input states
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Status & options
  const [status, setStatus] = useState<string>('CTT');
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositsList, setDepositsList] = useState<Array<{
    amount: number;
    paymentMethod: string;
    selectedBankAccount?: string;
    note: string;
  }>>([{ amount: 0, paymentMethod: 'CK', selectedBankAccount: '', note: 'Thanh toán lần thứ 1' }]);

  const { bankAccounts } = useBankAccounts();
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');

  // Modals for adding new supplier
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustTaxId, setNewCustTaxId] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Custom PurchaseOrder Number
  const [customPurchaseOrderNum, setCustomPurchaseOrderNum] = useState('');

  useEffect(() => {
    // Load all active products for autocomplete search
    const loadProducts = async () => {
      try {
        const res = await fetchWithAuth('/api/products?inStock=false');
        if (res.ok) {
          const data = await res.json();
          setProductsCache(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    // Load suppliers
    const loadSuppliers = async () => {
      try {
        const res = await fetchWithAuth('/api/suppliers');
        if (res.ok) {
          const data = await res.json();
          setSuppliersList(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadProducts();
    loadSuppliers();
  }, [successMsg]);

  // Autocomplete search filters
  const filteredProducts = productsCache.filter(p => 
    searchMatch(p.name, productSearchTerm) ||
    searchMatch(p.code, productSearchTerm) ||
    searchMatch(p.category, productSearchTerm)
  );

  const filteredSuppliers = suppliersList.filter(c => 
    searchMatch(c.name, supplierSearchTerm) ||
    (c.phone && c.phone.includes(supplierSearchTerm))
  );

  // Add Item
  const handleAddItem = (product: Product) => {
    setSaleItems([...saleItems, {
      product,
      quantity: 0,
      customPrice: product.price,
      customUnit: product.unit || '',
      hasVat: false,
      vatRate: 10
    }]);
    setProductSearchTerm('');
    setShowProductDropdown(false);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    const updated = [...saleItems];
    updated.splice(index, 1);
    setSaleItems(updated);
  };

  // Update Item details
  const handleUpdateQty = (index: number, val: number) => {
    const qty = Math.max(0, val);
    const updated = [...saleItems];
    updated[index].quantity = qty;
    setSaleItems(updated);
  };

  const handleUpdatePrice = (index: number, val: number) => {
    const prc = Math.max(0, val);
    const updated = [...saleItems];
    updated[index].customPrice = prc;
    setSaleItems(updated);
  };

  const handleUpdateUnit = (index: number, val: string) => {
    const updated = [...saleItems];
    updated[index].customUnit = val;
    setSaleItems(updated);
  };

  const handleUpdateVat = (index: number, hasVat: boolean) => {
    const updated = [...saleItems];
    updated[index].hasVat = hasVat;
    if (hasVat && !updated[index].vatRate) {
      updated[index].vatRate = 10;
    }
    setSaleItems(updated);
  };

  const handleUpdateVatRate = (index: number, rate: number) => {
    const updated = [...saleItems];
    updated[index].vatRate = Math.max(0, rate);
    setSaleItems(updated);
  };

  // Calculate Subtotal
  const calculateTotal = () => {
    return saleItems.reduce((acc, itm) => acc + (itm.quantity * itm.customPrice), 0);
  };

  // Add new supplier quick
  const handleQuickAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newCustName) return;

    try {
      const res = await fetchWithAuth('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCustName.trim(),
          phone: newCustPhone.trim() || null,
          address: newCustAddress.trim() || null,
          taxId: newCustTaxId.trim() || null
        })
      });

      if (!res.ok) {
        throw new Error("Lỗi khi tạo mới nhà cung cấp");
      }

      const createdSupplier = await res.json();
      setSelectedSupplier(createdSupplier);
      setSupplierSearchTerm(createdSupplier.name);
      setShowNewCustModal(false);
      // Reset
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustTaxId('');
      // Refresh supplier list
      const freshRes = await fetchWithAuth('/api/suppliers');
      if (freshRes.ok) {
        setSuppliersList(await freshRes.json());
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Submit Draft PurchaseOrder
  const handleCreateDraftPurchaseOrder = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (saleItems.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất một vật tư để lập phiếu nhập.");
      return;
    }

    const hasInvalidQty = saleItems.some(itm => itm.quantity <= 0);
    if (hasInvalidQty) {
      setErrorMsg("Số lượng của mỗi vật tư phải lớn hơn 0.");
      return;
    }

    setLoading(true);
    try {
      const finalStatus = status === 'CK' && selectedBankAccount ? `CK - ${selectedBankAccount}` : status;

      const payload = {
        supplierId: selectedSupplier ? selectedSupplier.id : null,
        status: finalStatus,
        depositEnabled,
        isRecorded: true, // Go straight to recorded (skip pending tab)
        purchaseOrderNumberCustom: customPurchaseOrderNum.trim() || undefined,
        items: saleItems.map(itm => ({
          productId: itm.product.id,
          productName: itm.product.name,
          productCode: itm.product.code,
          unit: itm.customUnit ?? itm.product.unit ?? '',
          quantity: itm.quantity,
          price: itm.customPrice,
          hasVat: itm.hasVat,
          vatRate: itm.vatRate
        })),
      };

      const res = await fetchWithAuth('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể tạo phiếu nhập");
      }

      const createdInv = await res.json();

      // If deposit is enabled, log all deposits
      if (depositEnabled) {
        for (let idx = 0; idx < depositsList.length; idx++) {
          const dep = depositsList[idx];
          if (dep.amount > 0) {
            const finalDepositMethod = dep.paymentMethod === 'CK' && dep.selectedBankAccount ? `CK - ${dep.selectedBankAccount}` : dep.paymentMethod;
            await fetchWithAuth(`/api/purchase-orders/${createdInv.id}/deposits`, {
              method: 'POST',
              body: JSON.stringify({
                amount: dep.amount,
                paymentMethod: finalDepositMethod,
                note: dep.note || `Thanh toán lần thứ ${idx + 1}`
              })
            });
          }
        }
      }

      setSuccessMsg(`Lập phiếu nhập thành công! Mã phiếu đã được chuyển vào Sổ Phiếu Nhập.`);
      
      // Reset Sales Workspace
      setSelectedSupplier(null);
      setSupplierSearchTerm('');
      setSaleItems([]);
      setCustomPurchaseOrderNum('');
      setDepositEnabled(false);
      setDepositsList([{ amount: 0, paymentMethod: 'CK', selectedBankAccount: '', note: 'Thanh toán lần thứ 1' }]);
      
      onPurchaseOrderCreated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="sales_container" className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      
      {/* Left 2 Columns: Cart and Items Selector */}
      <div className="lg:col-span-2 space-y-3">
        
        {/* Supplier & Document Info Header */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-indigo-500" />
              <span>Lập Phiếu Nhập Hàng</span>
            </h3>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">
              Khởi Tạo Đơn Hàng Mới
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* Supplier Search AutoComplete */}
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Tìm Khách Hàng (Tên hoặc số điện thoại)
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm nhà cung cấp cũ..."
                    value={supplierSearchTerm}
                    onChange={(e) => {
                      setSupplierSearchTerm(e.target.value);
                      setShowSupplierDropdown(true);
                      if (!e.target.value) {
                        setSelectedSupplier(null);
                      }
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                  />
                  {showSupplierDropdown && supplierSearchTerm && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-md max-h-40 overflow-y-auto z-40 divide-y divide-slate-100">
                      {filteredSuppliers.length === 0 ? (
                        <div className="p-2 text-[11px] text-slate-400 text-center">Không tìm thấy nhà cung cấp cũ. Click nút bên để thêm mới.</div>
                      ) : (
                        filteredSuppliers.map(cust => (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => {
                              setSelectedSupplier(cust);
                              setSupplierSearchTerm(cust.name);
                              setShowSupplierDropdown(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-50 transition-colors flex justify-between items-center"
                          >
                            <span className="font-bold text-slate-800">{cust.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{cust.phone || 'Không có sđt'}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(true)}
                  className="px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-md flex items-center justify-center transition-colors"
                  title="Thêm nhà cung cấp mới"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
              {selectedSupplier && (
                <div className="mt-1.5 text-[11px] bg-indigo-50/50 border border-indigo-100 rounded px-2 py-1 text-indigo-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold">{selectedSupplier.name}</span>
                    {selectedSupplier.phone && <span className="mx-1.5 font-mono text-slate-500">({selectedSupplier.phone})</span>}
                    {selectedSupplier.address && <p className="text-slate-500 text-[10px] mt-0.5">{selectedSupplier.address}</p>}
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedSupplier(null);
                      setSupplierSearchTerm('');
                    }}
                    className="text-indigo-500 hover:text-indigo-700 font-extrabold text-[10px]"
                  >
                    Xóa
                  </button>
                </div>
              )}
            </div>

            {/* Custom PurchaseOrder Number */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Số Phiếu Nhập Tùy Chỉnh (Nếu có)
              </label>
              <input
                type="text"
                placeholder="Để trống sẽ mặc định là 0"
                value={customPurchaseOrderNum}
                onChange={(e) => setCustomPurchaseOrderNum(e.target.value)}
                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-semibold text-slate-800"
              />
            </div>

          </div>
        </div>

        {/* Product Selection Tab */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-3">
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tìm kiếm vật tư thiết bị mặt trời để bán
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Gõ mã hoặc tên thiết bị (Ví dụ: PIN Canadian, Inverter, Khung đỡ...)"
                value={productSearchTerm}
                onChange={(e) => {
                  setProductSearchTerm(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-semibold text-slate-800"
              />
              
              {showProductDropdown && productSearchTerm && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-md max-h-52 overflow-y-auto z-40 divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <div className="p-2.5 text-xs text-slate-400 text-center">Không tìm thấy sản phẩm trong kho.</div>
                  ) : (
                    filteredProducts.map(p => {
                      const isLow = p.quantity <= p.minStock;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddItem(p)}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-50 transition-colors flex justify-between items-start"
                        >
                          <div>
                            <div className="font-bold text-slate-800">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <span>Mã: {p.code}</span>
                              <span>•</span>
                              <span>Nhóm: {p.category}</span>
                              {p.unit && (
                                <>
                                  <span>•</span>
                                  <span>ĐVT: {p.unit}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-[11px]">
                            <span className="font-bold text-slate-800 block font-mono">
                              Giá: {formatVND(p.price)} đ
                            </span>
                            <span className={`block mt-0.5 font-semibold ${isLow ? 'text-amber-600 font-black' : 'text-slate-400'}`}>
                              Tồn kho: {formatQuantity(p.quantity)} {p.unit || 'cái'}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cart Table (Super high density) */}
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-1.5 px-2.5">Vật Tư</th>
                  <th className="py-1.5 px-2.5 w-16 text-center">ĐVT</th>
                  <th className="py-1.5 px-2.5 w-24 text-center">Số Lượng</th>
                  <th className="py-1.5 px-2.5 w-40 text-right">Đơn Giá Nhập (VND)</th>
                  <th className="py-1.5 px-2.5 w-32 text-right">Thành Tiền</th>
                  <th className="py-1.5 px-2.5 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {saleItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-semibold italic">
                      Chưa chọn vật tư nào. Vui lòng tìm kiếm và thêm thiết bị ở trên.
                    </td>
                  </tr>
                ) : (
                  saleItems.map((item, index) => {
                    const baseTotal = item.quantity * item.customPrice;
                    const preVatTotal = item.hasVat && item.vatRate ? (baseTotal / (1 + item.vatRate / 100)) : baseTotal;
                    
                    return (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-1.5 px-2.5 align-top">
                        <div className="font-bold text-slate-900 leading-tight">{item.product.name}</div>
                        <div className="flex items-center gap-2 mt-0.5"><div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.product.code}</div><div className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 rounded font-medium">Kho: {item.product.warehouseName}</div></div>
                      </td>
                      <td className="py-1.5 px-2.5 align-top pt-2">
                        <input
                          type="text"
                          value={item.customUnit || ''}
                          onChange={(e) => handleUpdateUnit(index, e.target.value)}
                          placeholder="ĐVT..."
                          className="w-full text-center py-0.5 bg-slate-50 border border-slate-200 rounded font-semibold text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-1.5 px-2.5 align-top pt-2">
                        <QuantityInput
                          value={item.quantity}
                          onChange={(val) => handleUpdateQty(index, val)}
                          className="w-full text-center py-0.5 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-1.5 px-2.5 align-top pt-2">
                        {/* COMPACT NUMERIC PRICE INPUT */}
                        <div className="relative">
                          <PriceInput
                            value={item.customPrice}
                            onChange={(val) => handleUpdatePrice(index, val)}
                            className="w-full text-right pr-2 pl-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5 text-right align-top pt-2">
                        <div className="font-mono font-bold text-slate-900 mb-1 pt-0.5">
                          {formatVND(baseTotal)} đ
                        </div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={item.hasVat || false}
                              onChange={(e) => handleUpdateVat(index, e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] font-bold text-slate-600">VAT</span>
                          </label>
                          {item.hasVat && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={item.vatRate || 0}
                                onChange={(e) => handleUpdateVatRate(index, Number(e.target.value))}
                                className="w-10 px-1 py-0.5 text-[10px] font-mono border rounded text-right bg-slate-50"
                                min="0"
                                max="100"
                              />
                              <span className="text-[10px] text-slate-500">%</span>
                            </div>
                          )}
                        </div>
                        {item.hasVat && (
                          <div className="text-[9px] font-mono text-slate-500 whitespace-nowrap">
                            Trước VAT: {formatVND(preVatTotal)} đ
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-center align-top pt-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-slate-400 hover:text-red-500 rounded p-0.5 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right 1 Column: Summary & Payment Options */}
      <div className="space-y-3">
        
        {/* Sales Order summary box */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-3">
          <h3 className="font-display font-bold text-slate-800 text-sm border-b border-slate-100 pb-1.5">
            Thông Tin Đơn Hàng
          </h3>

          {errorMsg && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-[11px] rounded-md flex items-start gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-md flex items-start gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Status Select: 3 Required States */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Trạng Thái Phiếu Nhập</label>
            <div className="grid grid-cols-3 gap-0.5 bg-slate-100 p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => setStatus('CTT')}
                className={`py-1 text-[11px] font-bold rounded transition-all ${
                  status === 'CTT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Chưa cọc
              </button>
              <button
                type="button"
                onClick={() => setStatus('TM')}
                className={`py-1 text-[11px] font-bold rounded transition-all ${
                  status === 'TM' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setStatus('CK')}
                className={`py-1 text-[11px] font-bold rounded transition-all ${
                  status === 'CK' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Chuyển khoản
              </button>
            </div>
            {status === 'CK' && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1 items-center">
                  <select
                    value={selectedBankAccount}
                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                    className="flex-1 px-2 py-1 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 bg-slate-50 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Chọn tài khoản (Tùy chọn) --</option>
                    {bankAccounts.map(b => {
                      const bankStr = `${b.bankName} - ${b.accountNumber} - ${b.accountName}`;
                      return <option key={b.id} value={bankStr}>{bankStr}</option>;
                    })}
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="border border-slate-100 rounded-md p-2.5 space-y-2.5 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 cursor-pointer">
                <Coins className="w-3.5 h-3.5 text-amber-500" /> Kích hoạt thanh toán nhiều lần
              </label>
              <input
                type="checkbox"
                checked={depositEnabled}
                onChange={(e) => setDepositEnabled(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600 rounded"
              />
            </div>
            
            {depositEnabled && (
              <div className="space-y-3 pt-2.5 border-t border-slate-200/50 animate-in slide-in-from-top-2 duration-100 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Danh sách đợt thanh toán:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextNum = depositsList.length + 1;
                      setDepositsList([...depositsList, {
                        amount: 0,
                        paymentMethod: 'CK',
                        selectedBankAccount: '',
                        note: `Thanh toán lần thứ ${nextNum}`
                      }]);
                    }}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[10px] font-bold border border-indigo-200 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Thêm đợt thanh toán
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-0.5">
                  {depositsList.map((dep, idx) => (
                    <div key={idx} className="p-2 bg-white border border-slate-200 rounded-md relative space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 text-[10px]">Đợt thanh toán #{idx + 1}</span>
                        {depositsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...depositsList];
                              updated.splice(idx, 1);
                              // Re-sequence notes if they are defaults
                              const resequenced = updated.map((d, i) => {
                                if (d.note.startsWith('Thanh toán lần thứ')) {
                                  return { ...d, note: `Thanh toán lần thứ ${i + 1}` };
                                }
                                return d;
                              });
                              setDepositsList(resequenced);
                            }}
                            className="text-red-500 hover:text-red-700 font-bold text-[10px]"
                          >
                            Xóa đợt này
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Số tiền thanh toán</label>
                          <PriceInput
                            value={dep.amount}
                            onChange={(val) => {
                              const updated = [...depositsList];
                              updated[idx].amount = val;
                              setDepositsList(updated);
                            }}
                            className="w-full px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Phương thức</label>
                          <select
                            value={dep.paymentMethod}
                            onChange={(e) => {
                              const updated = [...depositsList];
                              updated[idx].paymentMethod = e.target.value;
                              setDepositsList(updated);
                            }}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 outline-none"
                          >
                            <option value="TM">Tiền mặt</option>
                            <option value="CK">Chuyển khoản</option>
                          </select>
                        </div>
                      </div>

                      {dep.paymentMethod === 'CK' && (
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Tài khoản ngân hàng</label>
                          <select
                            value={dep.selectedBankAccount || ''}
                            onChange={(e) => {
                              const updated = [...depositsList];
                              updated[idx].selectedBankAccount = e.target.value;
                              setDepositsList(updated);
                            }}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-[10px] font-semibold text-slate-700 bg-slate-50 outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Chọn tài khoản chuyển --</option>
                            {bankAccounts.map(b => {
                              const bankStr = `${b.bankName} - ${b.accountNumber} - ${b.accountName}`;
                              return <option key={b.id} value={bankStr}>{bankStr}</option>;
                            })}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ghi chú đợt thanh toán</label>
                        <input
                          type="text"
                          value={dep.note}
                          onChange={(e) => {
                            const updated = [...depositsList];
                            updated[idx].note = e.target.value;
                            setDepositsList(updated);
                          }}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-indigo-500"
                          placeholder="Nhập ghi chú thanh toán..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pricing Math */}
          <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Số loại vật tư:</span>
              <span className="font-bold text-slate-700">{saleItems.length}</span>
            </div>
            {depositEnabled && depositsList.reduce((sum, d) => sum + d.amount, 0) > 0 && (
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Đã thanh toán (Nhiều lần):</span>
                <span className="font-bold text-emerald-600">-{formatVND(depositsList.reduce((sum, d) => sum + d.amount, 0))} đ</span>
              </div>
            )}
            <div className="flex flex-col gap-1 border-t border-slate-200/50 pt-2">
              <div className="flex justify-between items-baseline">
                <span className="font-display font-bold text-slate-500 text-[10px] uppercase">Tổng (trước VAT):</span>
                <span className="font-mono text-xs font-bold text-slate-600">
                  {formatVND(saleItems.reduce((acc, item) => acc + (item.hasVat && item.vatRate ? ((item.quantity * item.customPrice) / (1 + item.vatRate / 100)) : item.quantity * item.customPrice), 0))} đ
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-display font-bold text-slate-900 text-xs uppercase">Tổng cộng:</span>
                <span className="font-mono text-base font-black text-indigo-600">
                  {formatVND(calculateTotal())} đ
                </span>
              </div>
            </div>
            {depositEnabled && depositsList.reduce((sum, d) => sum + d.amount, 0) > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-slate-500 font-bold">Còn lại cần thu:</span>
                <span className="font-mono text-xs font-bold text-slate-700">
                  {formatVND(Math.max(0, calculateTotal() - depositsList.reduce((sum, d) => sum + d.amount, 0)))} đ
                </span>
              </div>
            )}
          </div>

          {/* Draft Submission Button (puts purchaseOrder in "Trang chờ") */}
          <button
            type="button"
            disabled={loading || saleItems.length === 0}
            onClick={handleCreateDraftPurchaseOrder}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-md shadow-xs transition-all flex items-center justify-center gap-1.5 mt-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Lập Phiếu Nhập & Cộng Kho</span>
          </button>
          
          <p className="text-[10px] text-slate-400 text-center leading-normal">
            Phiếu nhập sẽ được ghi sổ tự động và cộng thẳng vào tồn kho vật lý. Bạn có thể xem và quản lý trong <b>Sổ Phiếu Nhập</b>.
          </p>
        </div>
      </div>

      {/* Quick Add Supplier Modal */}
      {showNewCustModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display font-semibold text-slate-800">Thêm Khách Hàng Nhanh</h3>
              <button onClick={() => setShowNewCustModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            
            <form onSubmit={handleQuickAddSupplier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên Khách Hàng / Đại Lý</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đại lý Đức Phát Solar"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số Điện Thoại</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 0987654321"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Địa Chỉ Giao Hàng</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Quận 12, Thành phố Hồ Chí Minh"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mã Số Thuế</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 0312345678"
                  value={newCustTaxId}
                  onChange={(e) => setNewCustTaxId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Lưu & Chọn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
