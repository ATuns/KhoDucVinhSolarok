import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Product, Customer, Warehouse, formatVND } from '../types.ts';
import { PriceInput } from './PriceInput.tsx';
import { QuantityInput } from './QuantityInput.tsx';
import { useBankAccounts } from './useBankAccounts.ts';
import { 
  Plus, Search, ShoppingBag, X, UserPlus, FileText, CheckCircle2, 
  Trash2, Coins, AlertCircle
} from 'lucide-react';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreated: () => void;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ isOpen, onClose, onInvoiceCreated }) => {
  const { fetchWithAuth } = useAuth();
  
  const [productsCache, setProductsCache] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [saleItems, setSaleItems] = useState<Array<{
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
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [status, setStatus] = useState<string>('CTT');
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositsList, setDepositsList] = useState<Array<{
    amount: number;
    paymentMethod: string;
    selectedBankAccount?: string;
    note: string;
  }>>([{ amount: 0, paymentMethod: 'CK', selectedBankAccount: '', note: 'Khách thanh toán lần thứ 1' }]);
  const { bankAccounts } = useBankAccounts();
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const loadData = async () => {
      try {
        const [prodRes, custRes, wRes] = await Promise.all([
          fetchWithAuth('/api/products?inStock=false'),
          fetchWithAuth('/api/customers'),
          fetchWithAuth('/api/warehouses')
        ]);
        if (prodRes.ok) setProductsCache(await prodRes.json());
        if (custRes.ok) setCustomersList(await custRes.json());
        if (wRes.ok) {
          const wData = await wRes.json();
          setWarehouses(wData);
          if (wData.length > 0) setSelectedWarehouseId(wData[0].id);
        }
      } catch (err) { console.error(err); }
    };
    loadData();
  }, [isOpen]);

  const handleCreateDraftInvoice = async () => {
    setErrorMsg('');
    if (saleItems.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất một vật tư.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        customerId: selectedCustomer ? selectedCustomer.id : null,
        customCustomerName: !selectedCustomer && customerSearchTerm.trim() !== '' ? customerSearchTerm.trim() : null,
        status: status,
        depositEnabled,
        items: saleItems.map(itm => ({
          productId: itm.product.id,
          productName: itm.customName ?? itm.product.name,
          productCode: itm.product.code,
          unit: itm.customUnit ?? itm.product.unit ?? '',
          quantity: itm.quantity,
          price: itm.customPrice,
          hasVat: itm.hasVat,
          vatRate: itm.vatRate
        })),
      };
      const res = await fetchWithAuth('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Không thể tạo hóa đơn");
      onInvoiceCreated();
      onClose();
    } catch (err: any) { setErrorMsg(err.message); } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-5xl w-full my-8 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-lg">Thêm Hóa Đơn Mới</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="p-6">
               <p className="text-sm text-slate-500">Đây là phần form tạo hóa đơn. [CHỨC NĂNG CHƯA ĐẦY ĐỦ TRONG POC NÀY - SẼ CẦN BỔ SUNG GIAO DIỆN FORM ĐẦY ĐỦ CỦA SalesTab.tsx]</p>
               {errorMsg && <p className="text-red-500 text-xs mt-2">{errorMsg}</p>}
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:text-slate-800">Hủy</button>
                <button onClick={handleCreateDraftInvoice} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Tạo Hóa Đơn</button>
            </div>
        </div>
    </div>
  );
};
