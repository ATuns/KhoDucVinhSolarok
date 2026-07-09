import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Product, Supplier, Warehouse, formatVND } from '../types.ts';
import { PriceInput } from './PriceInput.tsx';
import { QuantityInput } from './QuantityInput.tsx';
import { useBankAccounts } from './useBankAccounts.ts';
import { searchMatch } from '../utils.ts';
import {
  Plus, Search, ShoppingBag, X, UserPlus, FileText, CheckCircle2, 
  Trash2, Coins, AlertCircle
} from 'lucide-react';

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseOrderCreated: () => void;
}

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({ isOpen, onClose, onPurchaseOrderCreated }) => {
  const { fetchWithAuth } = useAuth();
  
  const [productsCache, setProductsCache] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [poItems, setPoItems] = useState<Array<{
    product: Product;
    quantity: number;
    customPrice: number;
    customName?: string;
    customUnit?: string;
    hasVat?: boolean;
    vatRate?: number;
    warehouseId?: number;
  }>>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [status, setStatus] = useState<string>('CTT');
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositsList, setDepositsList] = useState<Array<{
    amount: number;
    paymentMethod: string;
    selectedBankAccount?: string;
    note: string;
  }>>([{ amount: 0, paymentMethod: 'CK', selectedBankAccount: '', note: 'Đợt thanh toán 1' }]);
  const { bankAccounts } = useBankAccounts();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const loadData = async () => {
      try {
        const [prodRes, suppRes, wRes] = await Promise.all([
          fetchWithAuth('/api/products?inStock=false'),
          fetchWithAuth('/api/suppliers'),
          fetchWithAuth('/api/warehouses')
        ]);
        if (prodRes.ok) setProductsCache(await prodRes.json());
        if (suppRes.ok) setSuppliersList(await suppRes.json());
        if (wRes.ok) {
          const wData = await wRes.json();
          setWarehouses(wData);
          if (wData.length > 0) setSelectedWarehouseId(wData[0].id);
        }
      } catch (err) { console.error(err); }
    };
    loadData();
  }, [isOpen]);

  // Add Item
  const handleAddItem = (product: Product) => {
    // Check if item already added
    const idx = poItems.findIndex(item => item.product.id === product.id);
    if (idx > -1) {
      const updated = [...poItems];
      updated[idx].quantity = updated[idx].quantity === 0 ? 1 : updated[idx].quantity + 1;
      setPoItems(updated);
    } else {
      setPoItems([...poItems, {
        product,
        quantity: 0,
        customPrice: product.price,
        customUnit: product.unit || '',
        hasVat: false,
        vatRate: 10
      }]);
    }
    setProductSearchTerm('');
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    const updated = [...poItems];
    updated.splice(index, 1);
    setPoItems(updated);
  };

  // Update Item details
  const handleUpdateQty = (index: number, val: number) => {
    const qty = Math.max(0, val);
    const updated = [...poItems];
    updated[index].quantity = qty;
    setPoItems(updated);
  };

  const handleUpdatePrice = (index: number, val: number) => {
    const prc = Math.max(0, val);
    const updated = [...poItems];
    updated[index].customPrice = prc;
    setPoItems(updated);
  };

  // Calculate Subtotal
  const calculateTotal = () => {
    return poItems.reduce((acc, itm) => acc + (itm.quantity * itm.customPrice), 0);
  };

  const handleCreateDraftPurchaseOrder = async () => {
    setErrorMsg('');
    if (poItems.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất một vật tư.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        supplierId: selectedSupplier ? selectedSupplier.id : null,
        customSupplierName: !selectedSupplier && supplierSearchTerm.trim() !== '' ? supplierSearchTerm.trim() : null,
        status: status,
        depositEnabled,
        items: poItems.map(itm => ({
          productId: itm.product.id,
          productName: itm.customName ?? itm.product.name,
          productCode: itm.product.code,
          unit: itm.customUnit ?? itm.product.unit ?? '',
          quantity: itm.quantity,
          price: itm.customPrice,
          hasVat: itm.hasVat,
          vatRate: itm.vatRate,
          warehouseId: itm.product.warehouseId
        })),
      };
      const res = await fetchWithAuth('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Không thể tạo phiếu nhập");
      onPurchaseOrderCreated();
      onClose();
    } catch (err: any) { setErrorMsg(err.message); } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-5xl w-full my-8 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-lg">Thêm Phiếu Nhập Mới</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="p-6 space-y-4">
                {/* Product Search */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Tìm vật tư..."
                        value={productSearchTerm}
                        onChange={(e) => {
                            setProductSearchTerm(e.target.value);
                        }}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                    {productSearchTerm && (
                        <div className="absolute z-10 w-full bg-white border border-slate-200 mt-1 max-h-40 overflow-y-auto rounded-md shadow-lg">
                            {productsCache.filter(p => searchMatch(p.name, productSearchTerm)).map(p => (
                                <button key={p.id} className="w-full text-left p-2 hover:bg-slate-50 text-sm" onClick={() => handleAddItem(p)}>
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-2">Vật tư</th>
                            <th className="text-center py-2">ĐVT</th>
                            <th className="text-right py-2">Số lượng</th>
                            <th className="text-right py-2">Giá</th>
                            <th className="text-right py-2">Thành tiền</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {poItems.map((item, index) => (
                            <tr key={index} className="border-b">
                                <td className="py-2">
                                    <div className="font-medium">{item.product.name}</div>
                                    <div className="text-[10px] text-slate-500 font-mono">Mã: {item.product.code}</div>
                                </td>
                                <td className="py-2 text-center">
                                    <input
                                        type="text"
                                        value={item.customUnit || ''}
                                        onChange={(e) => {
                                            const updated = [...poItems];
                                            updated[index].customUnit = e.target.value;
                                            setPoItems(updated);
                                        }}
                                        className="w-16 px-1.5 py-0.5 border text-center font-semibold text-slate-800 bg-slate-50 focus:bg-white rounded text-xs font-mono"
                                    />
                                </td>
                                <td className="py-2 text-right">
                                    <QuantityInput value={item.quantity} onChange={(val) => handleUpdateQty(index, val)} />
                                </td>
                                <td className="py-2 text-right">
                                    <PriceInput value={item.customPrice} onChange={(val) => handleUpdatePrice(index, val)} />
                                </td>
                                <td className="py-2 text-right">{formatVND(item.quantity * item.customPrice)}</td>
                                <td className="py-2 text-right">
                                    <button onClick={() => handleRemoveItem(index)} className="text-red-500">X</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {errorMsg && <p className="text-red-500 text-xs mt-2">{errorMsg}</p>}
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:text-slate-800">Hủy</button>
                <button onClick={handleCreateDraftPurchaseOrder} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Tạo Phiếu Nhập</button>
            </div>
        </div>
    </div>
  );
};
