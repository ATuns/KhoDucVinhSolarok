import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Invoice, InvoiceItem, Deposit, InvoiceLog, Product, Customer, Warehouse, formatVND, formatQuantity } from '../types.ts';
import { PriceInput } from './PriceInput.tsx';
import { QuantityInput } from './QuantityInput.tsx';
import { useBankAccounts } from './useBankAccounts.ts';
import { CreateInvoiceModal } from './CreateInvoiceModal.tsx';
import { searchMatch } from '../utils.ts';
import { exportDocumentToExcel } from '../utils/excelExporter.ts';
import {
  Search, SlidersHorizontal, RefreshCw, Printer, Copy, Edit3, 
  Trash2, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, 
  Eye, CornerDownRight, Plus, Coins, Landmark, Clock, FileText, Check, ArrowRight, UserPlus,
  FileSpreadsheet
} from 'lucide-react';

export const InvoicesTab: React.FC<{ refreshTrigger: number; onInvoiceModified: () => void }> = ({ refreshTrigger, onInvoiceModified }) => {
  const { fetchWithAuth } = useAuth();
  
  // State lists
  const [invoiceList, setInvoiceList] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRecorded, setFilterRecorded] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [totalAmountSum, setTotalAmountSum] = useState<number>(0);
  const [totalInvoicesCount, setTotalInvoicesCount] = useState<number>(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Detail view/Edit
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // ... (existing states)
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // States for Editing Invoice
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);
  const [showTemplateSelectionModal, setShowTemplateSelectionModal] = useState(false);
  const [productsCache, setProductsCache] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editStatus, setEditStatus] = useState<string>('CTT');
  const { bankAccounts } = useBankAccounts();
  const [editBankAccountId, setEditBankAccountId] = useState<string>('');
  const [selectedDepositBankAccount, setSelectedDepositBankAccount] = useState<string>('');
  const [editDepositEnabled, setEditDepositEnabled] = useState(false);
  const [editDeposits, setEditDeposits] = useState<Deposit[]>([]);
  const [editCreatedAt, setEditCreatedAt] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // States for Quick Add Customer in Edit mode
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustTaxId, setNewCustTaxId] = useState('');

  // Deposit log popover
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositMethod, setDepositMethod] = useState<string>('CK');
  const [depositNote, setDepositNote] = useState('');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);

  // Print template selection
  const [printType, setPrintType] = useState<'standard' | 'vat' | 'delivery'>('standard');

  const currentFetchId = useRef(0);

  const loadInvoices = async () => {
    const fetchId = ++currentFetchId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus) params.append('status', filterStatus);
      if (filterRecorded) params.append('isRecorded', filterRecorded);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (sortOrder) params.append('sort', sortOrder);

      const res = await fetchWithAuth(`/api/invoices?${params.toString()}`);
      if (fetchId !== currentFetchId.current) return;
      if (res.ok) {
        const data = await res.json();
        if (fetchId !== currentFetchId.current) return;
        setInvoiceList(data.invoices || []);
        setTotalPages(data.totalPages || 1);
        setTotalAmountSum(data.totalAmountSum || 0);
        setTotalInvoicesCount(data.total || 0);
      } else {
        throw new Error("KhÃ´ng thá»ƒ táº£i danh sÃ¡ch thá»‘ng kÃª hÃ³a Ä‘Æ¡n");
      }
    } catch (err: any) {
      if (fetchId !== currentFetchId.current) return;
      setErrorMsg(err.message);
    } finally {
      if (fetchId === currentFetchId.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [currentPage, searchTerm, filterStatus, filterRecorded, filterStartDate, filterEndDate, sortOrder, refreshTrigger]);

  useEffect(() => {
    const loadCacheData = async () => {
      try {
        const prodRes = await fetchWithAuth('/api/products?inStock=false');
        if (prodRes.ok) {
          setProductsCache(await prodRes.json());
        }
        const custRes = await fetchWithAuth('/api/customers');
        if (custRes.ok) {
          setCustomersList(await custRes.json());
        }
        const wRes = await fetchWithAuth('/api/warehouses');
        if (wRes.ok) {
          const wData = await wRes.json();
          setWarehouses(wData);
          if (wData.length > 0) setSelectedWarehouseId(wData[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadCacheData();
  }, []);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.startsWith('#doc=')) {
        const doc = window.location.hash.replace('#doc=', '');
        setSearchTerm(doc);
        window.location.hash = '';
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Filter lists
  const filteredProducts = productsCache.filter(p => 
    (selectedWarehouseId ? p.warehouseId === selectedWarehouseId : false) &&
    (searchMatch(p.name, productSearch) ||
    searchMatch(p.code, productSearch) ||
    searchMatch(p.category, productSearch))
  );

  const filteredCustomers = customersList.filter(c => 
    searchMatch(c.name, customerSearch) ||
    (c.phone && c.phone.includes(customerSearch)) ||
    (c.taxId && c.taxId.includes(customerSearch))
  );

  const startEditing = () => {
    if (!selectedInvoice) return;
    const foundCust = customersList.find(c => c.id === selectedInvoice.customerId) || null;
    setEditCustomer(foundCust);
    setCustomerSearch(selectedInvoice.customerName || '');
    setEditItems(selectedInvoice.items ? selectedInvoice.items.map(item => ({ ...item })) : []);
    setEditInvoiceNumber(selectedInvoice.invoiceNumber);
    setEditStatus(selectedInvoice.status);
    setEditBankAccountId(selectedInvoice.bankAccountId ? String(selectedInvoice.bankAccountId) : '');
    setEditDepositEnabled(selectedInvoice.depositEnabled);
    setEditDeposits(selectedInvoice.deposits ? selectedInvoice.deposits.map(dep => ({ ...dep })) : []);
    if (selectedInvoice.createdAt) {
      // Convert to local datetime string format for input type="datetime-local"
      const date = new Date(selectedInvoice.createdAt);
      const localStr = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEditCreatedAt(localStr);
    } else {
      setEditCreatedAt('');
    }
    setIsEditing(true);
    setProductSearch('');
  };

  const handleAddEditItem = (product: Product) => {
    setEditItems([...editItems, {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      unit: product.unit || '',
      quantity: 0,
      price: product.price,
      totalPrice: 0,
      hasVat: false,
      vatRate: 10,
      warehouseId: product.warehouseId || selectedWarehouseId || undefined
    }]);
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const handleRemoveEditItem = (index: number) => {
    const updated = [...editItems];
    updated.splice(index, 1);
    setEditItems(updated);
  };

  const handleUpdateEditProductName = (index: number, val: string) => {
    const updated = [...editItems];
    updated[index].productName = val;
    setEditItems(updated);
  };

  const handleUpdateEditUnit = (index: number, val: string) => {
    const updated = [...editItems];
    updated[index].unit = val;
    setEditItems(updated);
  };

  const handleUpdateEditQty = (index: number, val: number) => {
    const qty = Math.max(0, val);
    const updated = [...editItems];
    updated[index].quantity = qty;
    updated[index].totalPrice = qty * updated[index].price;
    setEditItems(updated);
  };

  const handleUpdateEditPrice = (index: number, val: number) => {
    const prc = Math.max(0, val);
    const updated = [...editItems];
    updated[index].price = prc;
    updated[index].totalPrice = updated[index].quantity * prc;
    setEditItems(updated);
  };

  const handleUpdateEditVat = (index: number, hasVat: boolean) => {
    const updated = [...editItems];
    updated[index].hasVat = hasVat;
    if (hasVat && !updated[index].vatRate) {
      updated[index].vatRate = 10;
    }
    setEditItems(updated);
  };

  const handleUpdateEditVatRate = (index: number, rate: number) => {
    const updated = [...editItems];
    updated[index].vatRate = Math.max(0, rate);
    setEditItems(updated);
  };

  const calculateEditTotal = () => {
    return editItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  };

  const handleClearCustomer = () => {
    setEditCustomer(null);
    setCustomerSearch('');
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    try {
      const res = await fetchWithAuth('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCustName.trim(),
          phone: newCustPhone.trim() || null,
          address: newCustAddress.trim() || null,
          taxId: newCustTaxId.trim() || null
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Lá»—i khi táº¡o má»›i khÃ¡ch hÃ ng");
      }

      const createdCustomer = await res.json();
      setEditCustomer(createdCustomer);
      setCustomerSearch(createdCustomer.name);
      setShowNewCustModal(false);
      
      // Reset form states
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustTaxId('');

      // Refresh customer list
      const freshRes = await fetchWithAuth('/api/customers');
      if (freshRes.ok) {
        setCustomersList(await freshRes.json());
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateNewFromTemplate = async () => {
    setSavingEdit(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        customerId: editCustomer ? editCustomer.id : null,
        customCustomerName: !editCustomer && customerSearch.trim() !== '' ? customerSearch.trim() : null,
        status: editStatus,
        depositEnabled: editDepositEnabled,
        items: editItems.map(itm => ({
          productId: itm.productId,
          productName: itm.productName,
          productCode: itm.productCode,
          unit: itm.unit,
          quantity: itm.quantity,
          price: itm.price,
          hasVat: itm.hasVat,
          vatRate: itm.vatRate,
          warehouseId: itm.warehouseId
        })),
      };

      const res = await fetchWithAuth('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg('Táº¡o hÃ³a Ä‘Æ¡n má»›i tá»« máº«u thÃ nh cÃ´ng!');
        setIsEditing(false);
        setIsCreatingFromTemplate(false);
        loadInvoices();
        onInvoiceModified();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Táº¡o hÃ³a Ä‘Æ¡n tháº¥t báº¡i");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveInvoiceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingFromTemplate) {
        await handleCreateNewFromTemplate();
        return;
    }
    
    if (!selectedInvoice) return;
    if (editItems.length === 0) {
      alert("HÃ³a Ä‘Æ¡n pháº£i cÃ³ Ã­t nháº¥t má»™t váº­t tÆ°.");
      return;
    }

    const hasInvalidQty = editItems.some(itm => itm.quantity <= 0);
    if (hasInvalidQty) {
      alert("Sá»‘ lÆ°á»£ng cá»§a má»—i váº­t tÆ° pháº£i lá»›n hÆ¡n 0.");
      return;
    }

    setSavingEdit(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        customerId: editCustomer ? editCustomer.id : null,
        customCustomerName: !editCustomer && customerSearch.trim() !== '' ? customerSearch.trim() : null,
        invoiceNumber: editInvoiceNumber.trim(),
        status: editStatus,
        bankAccountId: editBankAccountId || null,
        depositEnabled: editDepositEnabled,
        createdAt: editCreatedAt ? new Date(editCreatedAt).toISOString() : undefined,
        items: editItems.map(itm => ({
          productId: itm.productId,
          productName: itm.productName,
          productCode: itm.productCode,
          unit: itm.unit || '',
          quantity: itm.quantity,
          price: itm.price,
          hasVat: itm.hasVat,
          vatRate: itm.vatRate,
          warehouseId: itm.warehouseId,
        })),
        deposits: editDeposits.map(dep => ({
          amount: dep.amount,
          paymentMethod: dep.paymentMethod,
          note: dep.note,
          createdAt: dep.createdAt,
        })),
      };

      const res = await fetchWithAuth(`/api/invoices/${selectedInvoice.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMsg("Cáº­p nháº­t hÃ³a Ä‘Æ¡n thÃ nh cÃ´ng!");
        setIsEditing(false);
        loadInvoices();
        viewInvoiceDetail(selectedInvoice.id);
        onInvoiceModified();
      } else {
        const data = await res.json();
        throw new Error(data.error || "KhÃ´ng thá»ƒ cáº­p nháº­t hÃ³a Ä‘Æ¡n");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Fetch full details
  const viewInvoiceDetail = async (id: number) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const res = await fetchWithAuth(`/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedInvoice(data);
      } else {
        throw new Error("KhÃ´ng thá»ƒ láº¥y chi tiáº¿t hÃ³a Ä‘Æ¡n");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Change payment status (Regenerates document code)
  const handleChangeStatus = async (id: number, newStatus: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetchWithAuth(`/api/invoices/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        setSuccessMsg("Cáº­p nháº­t tráº¡ng thÃ¡i vÃ  tá»± Ä‘á»™ng thay Ä‘á»•i mÃ£ chá»©ng tá»« thÃ nh cÃ´ng!");
        loadInvoices();
        if (showDetailModal && selectedInvoice?.id === id) {
          viewInvoiceDetail(id); // Reload modal details
        }
        onInvoiceModified();
      } else {
        const data = await res.json();
        throw new Error(data.error || "KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Record/Ghi sá»• invoice
  const handleRecordInvoice = async (id: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetchWithAuth(`/api/invoices/${id}/record`, {
        method: 'POST'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ghi sá»• tháº¥t báº¡i");
      }

      const result = await res.json();
      setSuccessMsg(result.message || "Ghi sá»• thÃ nh cÃ´ng!");
      loadInvoices();
      if (showDetailModal && selectedInvoice?.id === id) {
        viewInvoiceDetail(id);
      }
      onInvoiceModified();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Unrecord/Bá» ghi sá»• invoice
  const handleUnrecordInvoice = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      message: "Bá» ghi sá»• sáº½ hoÃ n tráº£ láº¡i váº­t tÆ° vÃ o kho vÃ  chuyá»ƒn hÃ³a Ä‘Æ¡n vá» tráº¡ng thÃ¡i chá». Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n bá» ghi sá»•?",
      onConfirm: async () => {
        setConfirmDialog(null);
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await fetchWithAuth(`/api/invoices/${id}/unrecord`, {
            method: 'POST'
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Bá» ghi sá»• tháº¥t báº¡i");
          }

          const result = await res.json();
          setSuccessMsg(result.message || "Bá» ghi sá»• thÃ nh cÃ´ng!");
          loadInvoices();
          if (showDetailModal && selectedInvoice?.id === id) {
            viewInvoiceDetail(id);
          }
          onInvoiceModified();
        } catch (err: any) {
          setErrorMsg(err.message);
        }
      }
    });
  };

  // Duplicate Invoice (NhÃ¢n báº£n)
  const handleDuplicateInvoice = async (id: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetchWithAuth(`/api/invoices/${id}/duplicate`, {
        method: 'POST'
      });

      if (res.ok) {
        const result = await res.json();
        setSuccessMsg(`NhÃ¢n báº£n hÃ³a Ä‘Æ¡n nhÃ¡p thÃ nh cÃ´ng! ÄÆ¡n má»›i #${result.invoiceNumber} Ä‘Ã£ Ä‘Æ°á»£c thÃªm vÃ o Trang Chá».`);
        loadInvoices();
        onInvoiceModified();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "NhÃ¢n báº£n tháº¥t báº¡i");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateFromTemplate = (inv: Invoice) => {
    // 1. Open Detail Modal
    setSelectedInvoice(inv);
    setShowDetailModal(true);
    
    // 2. Prepare for Edit
    setEditItems(inv.items ? inv.items.map(item => ({ ...item })) : []);
    
    // Reconstruct customer object from invoice fields
    if (inv.customerId) {
      setEditCustomer({
        id: inv.customerId,
        name: inv.customerName || '',
        phone: inv.customerPhone,
        address: inv.customerAddress,
        taxId: inv.customerTaxId
      });
      setCustomerSearch(inv.customerName || '');
    } else {
      setEditCustomer(null);
      setCustomerSearch(inv.customerName || '');
    }
    
    setEditInvoiceNumber(''); // Clear invoice number
    setEditStatus('CTT'); // Reset status
    setEditBankAccountId('');
    setEditDepositEnabled(false);
    setEditDeposits([]);
    setEditCreatedAt(''); // Clear created at
    
    // 3. Set Edit Mode
    setIsEditing(true);
    setIsCreatingFromTemplate(true);
    setProductSearch('');
  };

  const handleCreateBlankInvoice = () => {
    // 1. Prepare for Edit (Blank)
    setEditItems([]);
    setEditCustomer(null);
    setCustomerSearch('');
    setEditInvoiceNumber('');
    setEditStatus('CTT');
    setEditBankAccountId('');
    setEditDepositEnabled(false);
    setEditDeposits([]);
    setEditCreatedAt('');
    
    // 2. Set Edit Mode
    setIsEditing(true);
    setIsCreatingFromTemplate(true);
    setProductSearch('');
    setSelectedInvoice(null); // No selected invoice
    setShowDetailModal(true); // Open modal
  };

  // Delete Invoice
  const handleDeleteInvoice = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      message: "Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n chuyá»ƒn hÃ³a Ä‘Æ¡n nÃ y vÃ o thÃ¹ng rÃ¡c?",
      onConfirm: async () => {
        setConfirmDialog(null);
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await fetchWithAuth(`/api/invoices/${id}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            setSuccessMsg("ÄÃ£ chuyá»ƒn hÃ³a Ä‘Æ¡n vÃ o thÃ¹ng rÃ¡c!");
            setShowDetailModal(false);
            loadInvoices();
            onInvoiceModified();
          } else {
            const errData = await res.json();
            throw new Error(errData.error || "XÃ³a hÃ³a Ä‘Æ¡n tháº¥t báº¡i");
          }
        } catch (err: any) {
          setErrorMsg(err.message);
        }
      }
    });
  };

  // Add Deposit payment
  const handleAddDepositPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || depositAmount <= 0) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const finalDepositMethod = depositMethod === 'CK' && selectedDepositBankAccount ? `CK - ${selectedDepositBankAccount}` : depositMethod;
      const res = await fetchWithAuth(`/api/invoices/${selectedInvoice.id}/deposits`, {
        method: 'POST',
        body: JSON.stringify({
          amount: depositAmount,
          paymentMethod: finalDepositMethod,
          note: depositNote.trim()
        })
      });

      if (res.ok) {
        setSuccessMsg(`ÄÃ£ nháº­n cá»c thÃªm ${formatVND(depositAmount)} Ä‘ thÃ nh cÃ´ng!`);
        setShowAddDeposit(false);
        setDepositAmount(0);
        setDepositNote('');
        viewInvoiceDetail(selectedInvoice.id); // reload
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Ghi nháº­n cá»c tháº¥t báº¡i");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Helper for status styling
  const getStatusBadge = (status: string) => {
    if (status === 'CTT') {
      return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-red-50 text-red-700 border border-red-200">CHÆ¯A THANH TOÃN</span>;
    }
    if (status === 'TM') {
      return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">TIá»€N Máº¶T</span>;
    }
    if (status === 'CK' || (status && status.startsWith('CK'))) {
      return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">CHUYá»‚N KHOáº¢N</span>;
    }
    return null;
  };

  // Custom print handler
  const handlePrint = () => {
    const printContent = document.getElementById('printable_invoice_area');
    if (!printContent) return;

    const originalContent = document.body.innerHTML;
    const originalHead = document.head.innerHTML;

    // Open a simple print view
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>In hÃ³a Ä‘Æ¡n</title>
            <style>
              body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
              .font-mono { font-family: monospace; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .border-b { border-bottom: 1px solid #e2e8f0; }
              .py-2 { padding-top: 8px; padding-bottom: 8px; }
              .font-bold { font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; }
              th { background-color: #f1f5f9; }
              .invoice-header { display: flex; justify-content: space-between; margin-bottom: 40px; }
              .company-info { max-width: 60%; }
              .logo { font-size: 24px; font-weight: bold; color: #4f46e5; margin-bottom: 5px; }
              .title { font-size: 28px; text-align: center; font-weight: bold; margin-bottom: 30px; letter-spacing: -1px; }
              .summary-box { margin-top: 30px; border-top: 2px solid #94a3b8; padding-top: 15px; width: 40%; margin-left: auto; }
              .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
              .customer-info-box { border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  return (
    <div id="invoices_container" className="space-y-3">
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-base font-bold tracking-tight text-slate-900">Sá»• Thá»‘ng KÃª HÃ³a ÄÆ¡n</h1>
          <p className="text-xs text-slate-500">Xem bÃ¡o cÃ¡o, sao chÃ©p, in áº¥n vÃ  quáº£n lÃ½ tráº¡ng thÃ¡i xuáº¥t kho ghi sá»•</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                setLoading(true);
                const res = await fetchWithAuth('/api/invoices/create-blank', {
                  method: 'POST',
                });
                if (!res.ok) throw new Error("KhÃ´ng thá»ƒ táº¡o hÃ³a Ä‘Æ¡n má»›i");
                loadInvoices(); // Assuming this is the function to reload invoices
              } catch (err: any) {
                setErrorMsg(err.message);
              } finally {
                setLoading(false);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Táº¡o HÃ³a ÄÆ¡n Tráº¯ng
          </button>
        </div>
      </div>

      <CreateInvoiceModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onInvoiceCreated={() => {
            loadInvoices();
            onInvoiceModified();
        }}
      />

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

      {/* Query Filters */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-2.5 flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
        
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="TÃ¬m theo mÃ£ chá»©ng tá»«, sá»‘ hÃ³a Ä‘Æ¡n, khÃ¡ch hÃ ng..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: '453.719px' }}
            className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range inputs */}
          <div 
            style={{ width: '304.281px' }}
            className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5"
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase">Tá»«</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => {
                setFilterStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 text-xs text-slate-700 bg-transparent border-0 focus:outline-none"
            />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Äáº¿n</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => {
                setFilterEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 text-xs text-slate-700 bg-transparent border-0 focus:outline-none"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: '169px' }}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">-- Tráº¡ng thÃ¡i thanh toÃ¡n --</option>
            <option value="CTT">ChÆ°a thanh toÃ¡n</option>
            <option value="TM">Tiá»n máº·t</option>
            <option value="CK">Chuyá»ƒn khoáº£n</option>
          </select>

          <select
            value={filterRecorded}
            onChange={(e) => {
              setFilterRecorded(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: '162px' }}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">-- Tráº¡ng thÃ¡i ghi sá»• --</option>
            <option value="true">ÄÃ£ ghi sá»• (Trá»« kho)</option>
            <option value="false">ChÆ°a ghi sá»• (Trang chá»)</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: '150px' }}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
          >
            <option value="desc">Má»›i nháº¥t tá»›i cÅ© nháº¥t</option>
            <option value="asc">CÅ© nháº¥t tá»›i má»›i nháº¥t</option>
          </select>

          {(filterStatus || filterRecorded || searchTerm || filterStartDate || filterEndDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('');
                setFilterRecorded('');
                setFilterStartDate('');
                setFilterEndDate('');
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset bá»™ lá»c</span>
            </button>
          )}
        </div>
      </div>

      {/* Structured Table List */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-3 py-2.5">TÃªn KhÃ¡ch</th>
                <th className="px-3 py-2.5">MÃ£ sá»‘ thuáº¿</th>
                <th className="px-3 py-2.5">Sá»‘ chá»©ng tá»«</th>
                <th className="px-3 py-2.5">Sá»‘ HÃ³a Ä‘Æ¡n</th>
                <th className="px-3 py-2.5">NgÃ y</th>
                <th className="px-3 py-2.5 text-right">ThÃ nh tiá»n</th>
                <th className="px-3 py-2.5">Tráº¡ng thÃ¡i</th>
                <th className="px-3 py-2.5 text-center">Chá»©c NÄƒng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-500" />
                    <span className="text-xs font-semibold">Äang táº£i danh sÃ¡ch hÃ³a Ä‘Æ¡n...</span>
                  </td>
                </tr>
              ) : invoiceList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400 font-semibold">
                    KhÃ´ng tÃ¬m tháº¥y hÃ³a Ä‘Æ¡n nÃ o trong cÆ¡ sá»Ÿ dá»¯ liá»‡u.
                  </td>
                </tr>
              ) : (
                invoiceList.map((inv) => (
                  <tr 
                    key={inv.id}
                    className={`hover:bg-slate-50/50 transition-colors ${
                      inv.isRecorded ? 'bg-emerald-50/5' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      <div>
                        {inv.customerName || 'KhÃ¡ch vÃ£ng lai'}
                      </div>
                      {inv.customerPhone && (
                        <div className="text-[10px] text-slate-400 font-mono">SÄT: {inv.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">
                      {inv.customerTaxId || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600 font-semibold">
                      {inv.documentCode}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600 font-semibold">
                      #{inv.invoiceNumber}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleString('vi-VN') : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-indigo-600">
                      {formatVND(inv.depositEnabled ? Number(inv.totalAmount || 0) - Number(inv.totalDeposits || 0) : Number(inv.totalAmount || 0))} Ä‘
                    </td>
                    <td className="px-3 py-2.5 space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        {getStatusBadge(inv.status)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => viewInvoiceDetail(inv.id)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center gap-0.5 text-[11px] font-bold cursor-pointer"
                          title="Xem chi tiáº¿t & logs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem</span>
                        </button>

                        <button
                          onClick={() => handleDuplicateInvoice(inv.id)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center gap-0.5 text-[11px] font-bold cursor-pointer"
                          title="NhÃ¢n báº£n hÃ³a Ä‘Æ¡n nÃ y"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>NhÃ¢n báº£n</span>
                        </button>

                        {/* Toggle Recording (Post/Unpost) */}
                        {inv.isRecorded ? (
                          <button
                            onClick={() => handleUnrecordInvoice(inv.id)}
                            className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 text-[11px] font-bold rounded border border-amber-200 transition-colors cursor-pointer"
                            title="Bá» ghi sá»• hoÃ n tráº£ láº¡i hÃ ng vÃ o kho"
                          >
                            Bá» Ghi Sá»•
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRecordInvoice(inv.id)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded transition-colors cursor-pointer"
                            title="Ghi sá»• trá»« kho thiáº¿t bá»‹"
                          >
                            Ghi Sá»•
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-700">
                <td colSpan={5} className="px-3 py-3 text-left">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-700 font-bold uppercase tracking-wider text-[10px]">Tá»•ng sá»‘ phiáº¿u Ä‘Ã£ lá»c:</span>
                      <span className="font-mono font-black text-indigo-700 text-xs">{totalInvoicesCount}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100 flex flex-col items-end shrink-0">
                      <span className="text-indigo-700 font-bold uppercase tracking-wider text-[9px] whitespace-nowrap">Tá»•ng tiá»n Ä‘Æ°á»£c lá»c:</span>
                      <span className="font-mono font-black text-indigo-700 text-sm whitespace-nowrap">{formatVND(totalAmountSum)} Ä‘</span>
                    </div>
                  </div>
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pagination component */}
      {totalPages > 1 && (
        <div className="flex justify-start items-center gap-2 pt-2.5 border-t border-slate-200">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-sm font-semibold text-slate-600">
            Trang {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Detailed View / Audit Logs & Edit Modal */}
      {(showDetailModal && (selectedInvoice || isEditing)) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-[96vw] w-full my-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-slate-800 text-lg">
                  {isEditing ? (isCreatingFromTemplate ? "Táº¡o HÃ³a ÄÆ¡n Má»›i" : "Chá»‰nh Sá»­a HÃ³a ÄÆ¡n") : "Há»“ SÆ¡ HÃ³a ÄÆ¡n Chi Tiáº¿t"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEditing 
                    ? "Cáº­p nháº­t váº­t tÆ°, Ä‘Æ¡n giÃ¡, sá»‘ lÆ°á»£ng vÃ  Ä‘á»‘i tÃ¡c trÆ°á»›c khi ghi sá»•" 
                    : `Sá»‘: ${selectedInvoice?.invoiceNumber} â€¢ Chá»©ng tá»«: ${selectedInvoice?.documentCode}`}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedInvoice(null);
                  setIsEditing(false);
                  setIsCreatingFromTemplate(false);
                }} 
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                Ã—
              </button>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <span>Äang táº£i thÃ´ng tin...</span>
              </div>
            ) : isEditing ? (
              <div className="p-6 max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleSaveInvoiceEdit} className="space-y-4">
                  {/* Alert errors inside form */}
                  {errorMsg && (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>{errorMsg}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Basic Invoice fields */}
                    <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">ThÃ´ng Tin Chung</h4>
                      
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Sá»‘ hÃ³a Ä‘Æ¡n</label>
                        <input
                          type="text"
                          placeholder="Äá»ƒ trá»‘ng sáº½ máº·c Ä‘á»‹nh lÃ  0"
                          value={editInvoiceNumber}
                          onChange={(e) => setEditInvoiceNumber(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">NgÃ y táº¡o hÃ³a Ä‘Æ¡n</label>
                        <input
                          type="datetime-local"
                          value={editCreatedAt}
                          onChange={(e) => setEditCreatedAt(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">HÃ¬nh thá»©c thanh toÃ¡n</label>
                        <select
                          value={editStatus}
                          onChange={(e: any) => setEditStatus(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                        >
                          <option value="CTT">ChÆ°a thanh toÃ¡n</option>
                          <option value="TM">Tiá»n máº·t</option>
                          <option value="CK">Chuyá»ƒn khoáº£n</option>
                        </select>
                      </div>

                      {editStatus === 'CK' && (
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">TÃ i khoáº£n nháº­n</label>
                          <select
                            value={editBankAccountId}
                            onChange={(e) => setEditBankAccountId(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                          >
                            <option value="">-- Chá»n tÃ i khoáº£n --</option>
                            {bankAccounts.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.bankName} - {b.accountNumber} ({b.accountName})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="edit_deposit_enabled"
                          checked={editDepositEnabled}
                          onChange={(e) => setEditDepositEnabled(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded animate-none"
                        />
                        <label htmlFor="edit_deposit_enabled" className="text-xs font-semibold text-slate-700 cursor-pointer">
                          KÃ­ch hoáº¡t thanh toÃ¡n nhiá»u láº§n
                        </label>
                      </div>
                    </div>

                    {/* Customer search field */}
                    <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 relative">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">KhÃ¡ch HÃ ng / Äá»‘i TÃ¡c</h4>
                      
                      <div className="relative">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[10px] text-slate-500 font-semibold uppercase">TÃ¬m kiáº¿m khÃ¡ch hÃ ng</label>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCustName(customerSearch);
                              setShowNewCustModal(true);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                          >
                            <UserPlus className="w-2.5 h-2.5" /> ThÃªm má»›i
                          </button>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Nháº­p tÃªn, sá»‘ Ä‘iá»‡n thoáº¡i hoáº·c MST..."
                            value={customerSearch}
                            onChange={(e) => {
                              setCustomerSearch(e.target.value);
                              setShowCustomerDropdown(true);
                            }}
                            onFocus={() => setShowCustomerDropdown(true)}
                            className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                          />
                          {editCustomer && (
                            <button
                              type="button"
                              onClick={handleClearCustomer}
                              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-sm font-bold"
                            >
                              Ã—
                            </button>
                          )}
                        </div>

                        {showCustomerDropdown && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)} />
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto z-50 divide-y divide-slate-100">
                              {customerSearch.trim() !== '' && (
                                <div
                                  onClick={() => {
                                    setNewCustName(customerSearch);
                                    setShowNewCustModal(true);
                                    setShowCustomerDropdown(false);
                                  }}
                                  className="p-2 text-xs text-indigo-600 hover:bg-indigo-50 cursor-pointer font-bold flex items-center gap-1 border-b border-indigo-50"
                                >
                                  <Plus className="w-3.5 h-3.5" /> + Táº¡o má»›i: "{customerSearch}"
                                </div>
                              )}
                              <div 
                                onClick={() => {
                                  setEditCustomer(null);
                                  setCustomerSearch('KhÃ¡ch hÃ ng vÃ£ng lai');
                                  setShowCustomerDropdown(false);
                                }}
                                className="p-2 text-xs text-slate-500 hover:bg-indigo-50 cursor-pointer font-semibold"
                              >
                                -- KhÃ¡ch hÃ ng vÃ£ng lai --
                              </div>
                              {filteredCustomers.map((cust) => (
                                <div
                                  key={cust.id}
                                  onClick={() => {
                                    setEditCustomer(cust);
                                    setCustomerSearch(cust.name);
                                    setShowCustomerDropdown(false);
                                  }}
                                  className="p-2 text-xs text-slate-700 hover:bg-indigo-50 cursor-pointer font-semibold flex justify-between"
                                >
                                  <span>{cust.name}</span>
                                  {cust.phone && <span className="text-[10px] text-slate-400 font-mono">{cust.phone}</span>}
                                </div>
                              ))}
                              {filteredCustomers.length === 0 && (
                                <div className="p-2 text-xs text-slate-400 italic">KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng nÃ o.</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {editCustomer && (
                        <div className="p-2.5 bg-white rounded border text-xs space-y-1">
                          <div className="font-bold text-slate-800">{editCustomer.name}</div>
                          {editCustomer.phone && <div className="text-slate-500 font-mono">SÄT: {editCustomer.phone}</div>}
                          {editCustomer.address && <div className="text-slate-400 text-[11px] leading-tight">ÄC: {editCustomer.address}</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Search & Items List */}
                  <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Danh SÃ¡ch Thiáº¿t Bá»‹ / Váº­t TÆ°</h4>

                    {/* Product Autocomplete Input */}
                    <div className="relative">
                      <div className="flex gap-2 mb-1">
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">ThÃªm thiáº¿t bá»‹ vÃ o hÃ³a Ä‘Æ¡n</label>
                        </div>
                        <div className="w-1/3">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Chá»n Kho (Báº¯t buá»™c)
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 relative">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder={selectedWarehouseId ? "TÃ¬m theo tÃªn váº­t tÆ°, mÃ£ thiáº¿t bá»‹, danh má»¥c..." : "Vui lÃ²ng chá»n kho trÆ°á»›c Ä‘á»ƒ tÃ¬m kiáº¿m..."}
                            value={productSearch}
                            onChange={(e) => {
                              setProductSearch(e.target.value);
                              setShowProductDropdown(true);
                            }}
                            onFocus={() => {
                              if (selectedWarehouseId) setShowProductDropdown(true);
                            }}
                            disabled={!selectedWarehouseId}
                            className={`w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold ${!selectedWarehouseId ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-slate-800'}`}
                          />
                        </div>
                        <div className="w-1/3">
                          <select
                            value={selectedWarehouseId || ""}
                            onChange={(e) => setSelectedWarehouseId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800"
                          >
                            <option value="">-- Chá»n Kho --</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {showProductDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowProductDropdown(false)} />
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-50 divide-y divide-slate-100">
                            {filteredProducts.map((prod) => {
                              const warehouseQty = selectedWarehouseId && prod.warehouseQuantities ? (prod.warehouseQuantities[selectedWarehouseId] || 0) : 0;
                              return (
                              <div
                                key={prod.id}
                                onClick={() => {
                                  handleAddEditItem(prod);
                                }}
                                className="p-2 text-xs text-slate-700 hover:bg-indigo-50 cursor-pointer font-semibold flex justify-between items-center"
                              >
                                <div>
                                  <div className="font-normal text-[#373737] text-[11px]">{prod.name}</div>
                                  <div className="text-[12px] text-black font-mono">MÃ£: {prod.code} | Kho: {prod.warehouseName} | Tá»“n: {formatQuantity(prod.quantity)} {prod.unit || 'chiáº¿c'}</div>
                                </div>
                                <span className="text-indigo-600 font-mono text-xs font-bold">
                                  {formatVND(prod.price)} Ä‘
                                </span>
                              </div>
                            )})}
                            {filteredProducts.length === 0 && (
                              <div className="p-2 text-xs text-slate-400 italic">KhÃ´ng tÃ¬m tháº¥y thiáº¿t bá»‹ nÃ o phÃ¹ há»£p.</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Selected items table/list */}
                    <div className="border bg-white rounded-md overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 font-bold">
                            <th className="py-2 px-3">TÃªn Váº­t TÆ° / Thiáº¿t Bá»‹</th>
                            <th className="py-2 px-3 text-center w-16">ÄVT</th>
                            <th className="py-2 px-3 text-center w-24">Sá»‘ LÆ°á»£ng</th>
                            <th className="py-2 px-3 text-right w-32">ÄÆ¡n GiÃ¡ (Ä‘)</th>
                            <th className="py-2 px-3 text-right w-32">ThÃ nh Tiá»n</th>
                            <th className="py-2 px-3 text-center w-12">Ã—</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {editItems.map((item, idx) => {
                            const baseTotal = item.quantity * item.price;
                            const preVatTotal = item.hasVat && item.vatRate ? (baseTotal / (1 + item.vatRate / 100)) : baseTotal;
                            
                            const w = warehouses.find(wh => wh.id === item.warehouseId);
                            const wName = w ? w.name : 'ChÆ°a chá»n kho';
                            
                            return (
                              <tr key={idx}>
                                <td className="py-2 px-3 align-top">
                                  <input
                                    type="text"
                                    value={item.productName || ''}
                                    onChange={(e) => handleUpdateEditProductName(idx, e.target.value)}
                                    placeholder="TÃªn váº­t tÆ° / thiáº¿t bá»‹..."
                                    className="w-full px-2 py-1 border font-normal text-slate-800 bg-slate-50 focus:bg-white rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1"
                                  />
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <div className="font-mono font-bold text-[12px] text-black" style={{ fontStyle: 'normal' }}>{item.productCode}</div>
                                    <div className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 rounded font-medium">Kho: {wName}</div>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center align-top pt-3">
                                  <input
                                    type="text"
                                    value={item.unit || ''}
                                    onChange={(e) => handleUpdateEditUnit(idx, e.target.value)}
                                    placeholder="ÄVT..."
                                    className="w-full px-1.5 py-0.5 border text-center font-semibold text-slate-800 bg-slate-50 focus:bg-white rounded text-xs font-mono"
                                  />
                                </td>
                                <td className="py-2 px-3 text-center align-top pt-3">
                                  <QuantityInput
                                    required
                                    value={item.quantity}
                                    onChange={(val) => handleUpdateEditQty(idx, val)}
                                    className="w-16 px-1.5 py-0.5 border text-center font-bold text-slate-800 bg-slate-50 focus:bg-white rounded text-xs font-mono"
                                  />
                                </td>
                                <td className="py-2 px-3 text-right align-top pt-3">
                                  <PriceInput
                                    value={item.price}
                                    onChange={(val) => handleUpdateEditPrice(idx, val)}
                                    className="w-24 px-1.5 py-0.5 border text-right font-semibold text-slate-700 bg-slate-50 focus:bg-white rounded text-xs font-mono"
                                  />
                                </td>
                                <td className="py-2 px-3 text-right align-top">
                                  <div className="font-mono font-bold text-slate-900 mb-1">
                                    {formatVND(item.totalPrice)} Ä‘
                                  </div>
                                  <div className="flex items-center justify-end gap-2 mb-1">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={item.hasVat || false}
                                        onChange={(e) => handleUpdateEditVat(idx, e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span className="text-[10px] font-bold text-slate-600">VAT</span>
                                    </label>
                                    {item.hasVat && (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={item.vatRate || 0}
                                          onChange={(e) => handleUpdateEditVatRate(idx, Number(e.target.value))}
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
                                      TrÆ°á»›c VAT: {formatVND(preVatTotal)} Ä‘
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center align-top pt-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEditItem(idx)}
                                    className="p-1 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {editItems.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                                ChÆ°a cÃ³ váº­t tÆ° nÃ o Ä‘Æ°á»£c chá»n. HÃ£y dÃ¹ng Ã´ tÃ¬m kiáº¿m á»Ÿ trÃªn Ä‘á»ƒ thÃªm thiáº¿t bá»‹.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Total math */}
                    <div className="flex flex-col items-end gap-1 border-t border-slate-200 pt-3">
                      <div className="flex justify-between items-center w-full max-w-xs text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Tá»•ng thÃ nh tiá»n (trÆ°á»›c VAT):</span>
                        <span className="text-xs font-mono text-slate-600">
                          {formatVND(editItems.reduce((acc, item) => acc + (item.hasVat && item.vatRate ? ((item.quantity * item.price) / (1 + item.vatRate / 100)) : item.quantity * item.price), 0))} Ä‘
                        </span>
                      </div>
                      <div className="flex justify-between items-center w-full max-w-xs text-right">
                        <span className="text-xs font-bold text-slate-800 uppercase">Tá»•ng cá»™ng tiá»n hÃ ng:</span>
                        <span className="text-sm font-black text-indigo-600 font-mono">
                          {formatVND(calculateEditTotal())} Ä‘
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Deposits Editing Section */}
                  {editDepositEnabled && (
                    <div className="space-y-3 bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">ThÃ´ng Tin Thanh ToÃ¡n (Äá»£t thanh toÃ¡n)</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditDeposits([...editDeposits, {
                              id: 0,
                              invoiceId: selectedInvoice?.id || 0,
                              amount: 0,
                              paymentMethod: 'CK',
                              note: `KhÃ¡ch thanh toÃ¡n láº§n thá»© ${editDeposits.length + 1}`,
                              createdAt: new Date().toISOString()
                            }]);
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> ThÃªm Ä‘á»£t thanh toÃ¡n
                        </button>
                      </div>

                      {editDeposits.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">ChÆ°a cÃ³ thÃ´ng tin thanh toÃ¡n nÃ o Ä‘Æ°á»£c ghi nháº­n cho hÃ³a Ä‘Æ¡n nÃ y.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {editDeposits.map((dep, dIdx) => (
                            <div key={dIdx} className="bg-white p-2 border border-slate-200 rounded-md flex flex-wrap md:flex-nowrap gap-2 items-center justify-between">
                              <span className="text-xs font-bold text-slate-500">Äá»£t {dIdx + 1}</span>
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-[8px] font-bold text-slate-400 uppercase">Sá»‘ tiá»n thanh toÃ¡n</label>
                                <PriceInput
                                  value={dep.amount}
                                  onChange={(val) => {
                                    const updated = [...editDeposits];
                                    updated[dIdx].amount = val;
                                    setEditDeposits(updated);
                                  }}
                                  className="w-full px-1.5 py-0.5 border text-right font-bold text-slate-800 rounded text-xs font-mono bg-slate-50 focus:bg-white"
                                  placeholder="Sá»‘ tiá»n..."
                                />
                              </div>
                              <div className="w-28 shrink-0">
                                <label className="block text-[8px] font-bold text-slate-400 uppercase">PhÆ°Æ¡ng thá»©c</label>
                                <select
                                  value={dep.paymentMethod.startsWith('CK') ? 'CK' : dep.paymentMethod}
                                  onChange={(e) => {
                                    const updated = [...editDeposits];
                                    updated[dIdx].paymentMethod = e.target.value;
                                    setEditDeposits(updated);
                                  }}
                                  className="w-full px-1.5 py-0.5 border text-xs font-semibold rounded text-slate-700 bg-slate-50 focus:bg-white"
                                >
                                  <option value="CK">Chuyá»ƒn khoáº£n</option>
                                  <option value="TM">Tiá»n máº·t</option>
                                </select>
                              </div>
                              <div className="flex-1 min-w-[150px]">
                                <label className="block text-[8px] font-bold text-slate-400 uppercase">Ghi chÃº</label>
                                <input
                                  type="text"
                                  value={dep.note || ''}
                                  onChange={(e) => {
                                    const updated = [...editDeposits];
                                    updated[dIdx].note = e.target.value;
                                    setEditDeposits(updated);
                                  }}
                                  placeholder="Ghi chÃº (KhÃ¡ch thanh toÃ¡n...)"
                                  className="w-full px-1.5 py-0.5 border rounded text-xs text-slate-700 font-medium bg-slate-50 focus:bg-white"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...editDeposits];
                                  updated.splice(dIdx, 1);
                                  setEditDeposits(updated);
                                }}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded mt-3"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex justify-end gap-2 border-t pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-1.5 border hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-md transition-colors"
                    >
                      Há»§y Bá»
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-md shadow-xs transition-colors flex items-center gap-1"
                    >
                      {savingEdit ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      <span>{isCreatingFromTemplate ? "ThÃªm Má»›i" : "LÆ°u Thay Äá»•i"}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                
                {/* Print Layout Selection Tabs */}
                <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200 max-w-2xl print:hidden">
                  <button
                    type="button"
                    onClick={() => setPrintType('standard')}
                    className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                      printType === 'standard'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Phiáº¿u tiÃªu chuáº©n (KhÃ´ng VAT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintType('vat')}
                    className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                      printType === 'vat'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Phiáº¿u chi tiáº¿t VAT (CÃ³ TrÆ°á»›c VAT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintType('delivery')}
                    className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                      printType === 'delivery'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    BiÃªn báº£n bÃ n giao
                  </button>
                </div>

                {/* Printable Invoice Area (Clean corporate style matching exact reqs) */}
                <div id="printable_invoice_area" className="border border-slate-200 rounded-lg p-6 bg-white text-slate-800 overflow-x-auto">
                  <div style={{ fontFamily: '"Times New Roman", Times, serif', margin: '0 auto', maxWidth: '800px', fontSize: '14px', lineHeight: '1.4', color: 'black' }}>
                    {printType === 'delivery' ? (
                      <div style={{ padding: '10px 0' }}>
                        {/* Company Header matching image */}
                        <div style={{ marginBottom: '25px', fontFamily: '"Times New Roman", Times, serif' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '15px', textTransform: 'uppercase' }}>CÃ”NG TY TRÃCH NHIá»†M Há»®U Háº N Dá»ŠCH Vá»¤ VIá»„N THÃ”NG Äá»¨C VINH</div>
                          <div style={{ fontSize: '14px' }}>137 ÄÆ°á»ng Thá»›i Tam ThÃ´n 9, XÃ£ ÄÃ´ng Tháº¡nh, ThÃ nh phá»‘ Há»“ ChÃ­ Minh, Viá»‡t Nam.</div>
                        </div>

                        {/* Title Section */}
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '22px', letterSpacing: '0.5px' }}>BIÃŠN Báº¢N BÃ€N GIAO</div>
                          <div style={{ fontSize: '14px', fontStyle: 'italic' }}>
                            NgÃ y {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getDate()).padStart(2, '0') : '...'} thÃ¡ng {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getMonth() + 1).padStart(2, '0') : '...'} nÄƒm {selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).getFullYear() : '...'} táº¡i
                          </div>
                        </div>

                        {/* Party Information */}
                        <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '15px' }}>
                          <div>
                            <strong>Äáº¡i diá»‡n bÃªn nháº­n (BÃªn A):</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{selectedInvoice.customerName || "...................................................."}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ width: '50%' }}>Ã”ng (BÃ ): ....................................................</span>
                            <span style={{ width: '50%' }}>Chá»©c vá»¥: ....................................................</span>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <strong>Äáº¡i diá»‡n bÃªn giao (BÃªn B):</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>CÃ”NG TY TRÃCH NHIá»†M Há»®U Háº N Dá»ŠCH Vá»¤ VIá»„N THÃ”NG Äá»¨C VINH</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ width: '50%' }}>Ã”ng (BÃ ): ....................................................</span>
                            <span style={{ width: '50%' }}>Chá»©c vá»¥: ....................................................</span>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            NgÃ y {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getDate()).padStart(2, '0') : '...'} thÃ¡ng {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getMonth() + 1).padStart(2, '0') : '...'} nÄƒm {selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).getFullYear() : '...'} táº¡i
                          </div>
                          <div style={{ fontWeight: 'bold', marginTop: '6px' }}>
                            Hai bÃªn cÃ¹ng nhau bÃ n giao hÃ ng hoÃ¡ chi tiáº¿t nhÆ° sau:
                          </div>
                        </div>

                        {/* Items Table matching exact structure of the image */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                          <thead>
                            <tr>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', width: '40px', fontWeight: 'bold' }}>STT</th>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>TÃªn hÃ ng</th>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', width: '90px', fontWeight: 'bold' }}>ÄÆ¡n vá»‹ tÃ­nh</th>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', width: '90px', fontWeight: 'bold' }}>Sá»‘ lÆ°á»£ng</th>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', width: '180px', fontWeight: 'bold' }}>Cháº¥t lÆ°á»£ng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedInvoice.items?.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ border: '1px solid black', padding: '6px' }}>{item.productName}</td>
                                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.unit || "CÃ¡i"}</td>
                                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{formatQuantity(item.quantity)}</td>
                                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>Tá»‘t</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Warranty Information */}
                        <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '35px' }}>
                          <div>Vá» cháº¥t lÆ°á»£ng hÃ ng hÃ³a vÃ  phá»¥ kiá»‡n: HÃ ng hoÃ¡ Ä‘Æ°á»£c cung cáº¥p má»›i 100%.</div>
                          <div>BiÃªn báº£n nÃ y Ä‘Æ°á»£c láº­p thÃ nh 02 (hai) báº£n cÃ³ giÃ¡ trá»‹ nhÆ° nhau, má»—i bÃªn giá»¯ 01 (má»™t) báº£n Ä‘á»ƒ cÃ¹ng thá»±c hiá»‡n.</div>
                        </div>

                        {/* Signatures */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 40px 100px 40px', fontSize: '14px' }}>
                          <div style={{ textAlign: 'center', width: '250px' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Äáº I DIá»†N BÃŠN NHáº¬N</div>
                            <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#555' }}>(KÃ½, há» tÃªn)</div>
                          </div>
                          <div style={{ textAlign: 'center', width: '250px' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Äáº I DIá»†N BÃŠN GIAO</div>
                            <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#555' }}>(KÃ½, há» tÃªn)</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ border: '1px solid black' }}>
                        <div style={{ textAlign: 'center', borderBottom: '1px solid black', padding: '10px' }}>
                          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '18px' }}>CÃ”NG TY TNHH Dá»ŠCH Vá»¤ VIá»„N THÃ”NG Äá»¨C VINH</div>
                          <div>Äá»‹a chá»‰: 137 ÄÆ°á»ng Thá»›i Tam ThÃ´n 9, XÃ£ Thá»›i Tam ThÃ´n, Huyá»‡n HÃ³c MÃ´n, TP.Há»“ ChÃ­ Minh</div>
                          <div>MST: 0311193770</div>
                          <div>Hotline: 0938288876-0915877739.</div>
                          <div>FB: DUCVINHSOLAR-Website: Ducvinhsolar.com</div>
                        </div>
                        
                        <div style={{ textAlign: 'center', padding: '15px 15px 5px 15px' }}>
                          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '22px', marginBottom: '5px' }}>Báº¢NG BÃO GIÃ</div>
                          <div style={{ fontSize: '14px', fontStyle: 'italic' }}>NgÃ y {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getDate()).padStart(2, '0') : '...'} thÃ¡ng {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getMonth() + 1).padStart(2, '0') : '...'} nÄƒm {selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).getFullYear() : '...'}</div>
                          <div style={{ fontSize: '14px', marginBottom: '15px' }}>Sá»‘: {selectedInvoice.documentCode}</div>
                        </div>
                        
                        <div style={{ padding: '0 15px 15px 15px', borderBottom: '1px solid black' }}>
                          <div style={{ fontSize: '14px', marginBottom: '3px' }}><strong>TÃªn khÃ¡ch hÃ ng:</strong> {selectedInvoice.customerName || "...................................................."}</div>
                          <div style={{ fontSize: '14px', marginBottom: '3px' }}><strong>Äá»‹a chá»‰:</strong> {selectedInvoice.customerAddress || "...................................................."}</div>
                          <div style={{ fontSize: '14px', marginBottom: '3px' }}><strong>Sá»‘ Ä‘iá»‡n thoáº¡i:</strong> {selectedInvoice.customerPhone || "...................................................."}</div>
                          <div style={{ fontSize: '14px' }}><strong>MÃ£ sá»‘ thuáº¿:</strong> {selectedInvoice.customerTaxId || "...................................................."}</div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            {printType === 'vat' ? (
                              <tr>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '40px' }}>STT</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '100px' }}>MÃ£ sáº£n pháº©m</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>TÃªn thiáº¿t bá»‹</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '60px' }}>ÄÆ¡n vá»‹</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '60px' }}>Sá»‘ lÆ°á»£ng</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '90px' }}>ÄÆ¡n giÃ¡</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '50px' }}>VAT</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '100px' }}>TrÆ°á»›c VAT</th>
                                <th style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'center', width: '110px' }}>ThÃ nh tiá»n</th>
                              </tr>
                            ) : (
                              <tr>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '40px' }}>STT</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '100px' }}>MÃ£ sáº£n pháº©m</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>TÃªn thiáº¿t bá»‹</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '80px' }}>ÄÆ¡n vá»‹</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '80px' }}>Sá»‘ lÆ°á»£ng</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '100px' }}>ÄÆ¡n giÃ¡</th>
                                <th style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'center', width: '120px' }}>ThÃ nh tiá»n</th>
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            {printType === 'vat' ? (
                              <>
                                {selectedInvoice.items?.map((item, idx) => {
                                  const vatRate = item.hasVat ? (item.vatRate || 10) : 0;
                                  const lineTotal = item.quantity * item.price;
                                  const donGiaPreVat = item.hasVat ? (item.price / (1 + vatRate / 100)) : item.price;
                                  const truocVat = donGiaPreVat * item.quantity;
                                  return (
                                    <tr key={idx}>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.productCode || ""}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px' }}>{item.productName}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.unit || "CÃ¡i"}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{formatQuantity(item.quantity)}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'right' }}>{donGiaPreVat.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.hasVat ? `${vatRate}%` : '0%'}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'right' }}>{truocVat.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'right' }}>{lineTotal.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                  );
                                })}
                                <tr>
                                  <td colSpan={7} style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px' }}>
                                    <div style={{ display: 'flex', fontSize: '11px' }}>
                                      <span style={{ fontWeight: 'bold', width: '40px', textAlign: 'center', display: 'inline-block' }}>II</span>
                                      <span style={{ fontWeight: 'bold' }}>Tá»”NG Cá»˜NG TIá»€N HÃ€NG (TRÆ¯á»šC VAT)</span>
                                    </div>
                                  </td>
                                  <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                                    {(selectedInvoice.items?.reduce((acc, item) => {
                                      const vatRate = item.hasVat ? (item.vatRate || 10) : 0;
                                      const donGiaPreVat = item.hasVat ? (item.price / (1 + vatRate / 100)) : item.price;
                                      return acc + (donGiaPreVat * item.quantity);
                                    }, 0) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ borderBottom: '1px solid black', padding: '6px' }}></td>
                                </tr>
                                <tr>
                                  <td colSpan={7} style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px' }}>
                                    <div style={{ display: 'flex', fontSize: '11px' }}>
                                      <span style={{ fontWeight: 'bold', width: '40px', textAlign: 'center', display: 'inline-block' }}>III</span>
                                      <span style={{ fontWeight: 'bold' }}>Tá»”NG TIá»€N THUáº¾ GTGT (VAT)</span>
                                    </div>
                                  </td>
                                  <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                                    {(selectedInvoice.items?.reduce((acc, item) => {
                                      const vatRate = item.hasVat ? (item.vatRate || 10) : 0;
                                      const lineTotal = item.quantity * item.price;
                                      const donGiaPreVat = item.hasVat ? (item.price / (1 + vatRate / 100)) : item.price;
                                      const truocVat = donGiaPreVat * item.quantity;
                                      return acc + (lineTotal - truocVat);
                                    }, 0) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ borderBottom: '1px solid black', padding: '6px' }}></td>
                                </tr>
                                <tr>
                                  <td colSpan={8} style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px' }}>
                                    <div style={{ display: 'flex', fontSize: '11px' }}>
                                      <span style={{ fontWeight: 'bold', width: '40px', textAlign: 'center', display: 'inline-block' }}>IV</span>
                                      <span style={{ fontWeight: 'bold' }}>Tá»”NG Cá»˜NG TIá»€N THANH TOÃN</span>
                                    </div>
                                  </td>
                                  <td style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                                    {(selectedInvoice.items?.reduce((acc, item) => acc + (item.quantity * item.price), 0) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                                {selectedInvoice.depositEnabled && selectedInvoice.deposits && selectedInvoice.deposits.length > 0 && (
                                  <>
                                    {selectedInvoice.deposits.map((dep, depIdx) => (
                                      <tr key={`dep-${depIdx}`}>
                                        <td colSpan={8} style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', fontStyle: 'italic' }}>
                                          <div style={{ display: 'flex', fontSize: '11px' }}>
                                            <span style={{ width: '40px', textAlign: 'center', display: 'inline-block' }}>-</span>
                                            <span style={{ fontWeight: 'bold' }}>{dep.note || `KhÃ¡ch thanh toÃ¡n láº§n thá»© ${depIdx + 1}`}</span>
                                          </div>
                                        </td>
                                        <td style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'right', fontStyle: 'italic', fontWeight: 'bold', color: '#b45309' }}>
                                          -{dep.amount.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr>
                                      <td colSpan={8} style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px' }}>
                                        <div style={{ display: 'flex', fontSize: '11px' }}>
                                          <span style={{ fontWeight: 'bold', width: '40px', textAlign: 'center', display: 'inline-block' }}>V</span>
                                          <span style={{ fontWeight: 'bold' }}>CÃ’N Láº I Cáº¦N THANH TOÃN</span>
                                        </div>
                                      </td>
                                      <td style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#1e1b4b' }}>
                                        {((selectedInvoice.items?.reduce((acc, item) => acc + (item.quantity * item.price), 0) || 0) - (selectedInvoice.deposits?.reduce((acc, d) => acc + d.amount, 0) || 0)).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {selectedInvoice.items?.map((item, idx) => {
                                  const baseTotal = item.quantity * item.price;
                                  return (
                                    <tr key={idx}>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.productCode || ""}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px' }}>{item.productName}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.unit || "CÃ¡i"}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{formatQuantity(item.quantity)}</td>
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'right' }}>{item.price.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'right' }}>{baseTotal.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                  );
                                })}
                                <tr>
                                  <td colSpan={6} style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px' }}>
                                    <div style={{ display: 'flex' }}>
                                      <span style={{ fontWeight: 'bold', width: '40px', textAlign: 'center', display: 'inline-block' }}>II</span>
                                      <span style={{ fontWeight: 'bold' }}>Tá»”NG Cá»˜NG</span>
                                    </div>
                                  </td>
                                  <td style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                                    {(selectedInvoice.items?.reduce((acc, item) => acc + (item.quantity * item.price), 0) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                                {selectedInvoice.depositEnabled && selectedInvoice.deposits && selectedInvoice.deposits.length > 0 && (
                                  <>
                                    {selectedInvoice.deposits.map((dep, depIdx) => (
                                      <tr key={`dep-std-${depIdx}`}>
                                        <td colSpan={6} style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', fontStyle: 'italic' }}>
                                          <div style={{ display: 'flex' }}>
                                            <span style={{ width: '40px', textAlign: 'center', display: 'inline-block' }}>-</span>
                                            <span style={{ fontWeight: 'bold' }}>{dep.note || `KhÃ¡ch thanh toÃ¡n láº§n thá»© ${depIdx + 1}`}</span>
                                          </div>
                                        </td>
                                        <td style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'right', fontStyle: 'italic', fontWeight: 'bold', color: '#b45309' }}>
                                          -{dep.amount.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr>
                                      <td colSpan={6} style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px' }}>
                                        <div style={{ display: 'flex' }}>
                                          <span style={{ fontWeight: 'bold', width: '40px', textAlign: 'center', display: 'inline-block' }}>III</span>
                                          <span style={{ fontWeight: 'bold' }}>CÃ’N Láº I Cáº¦N THANH TOÃN</span>
                                        </div>
                                      </td>
                                      <td style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#1e1b4b' }}>
                                        {((selectedInvoice.items?.reduce((acc, item) => acc + (item.quantity * item.price), 0) || 0) - (selectedInvoice.deposits?.reduce((acc, d) => acc + d.amount, 0) || 0)).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  </>
                                )}
                              </>
                            )}
                          </tbody>
                        </table>

                        <div style={{ padding: '6px', textAlign: 'center', fontStyle: 'italic', fontWeight: 'bold' }}>
                          Báº±ng chá»¯: {(() => {
                            const totalInvoiceAmount = selectedInvoice.items?.reduce((acc, item) => acc + (item.quantity * item.price), 0) || 0;
                            const totalDepositsAmount = selectedInvoice.depositEnabled ? (selectedInvoice.deposits?.reduce((acc, d) => acc + d.amount, 0) || 0) : 0;
                            const amount = totalInvoiceAmount - totalDepositsAmount;
                            if (amount === 0) return "KhÃ´ng Ä‘á»“ng cháºµn./.";
                            const t = ["khÃ´ng", "má»™t", "hai", "ba", "bá»‘n", "nÄƒm", "sÃ¡u", "báº£y", "tÃ¡m", "chÃ­n"];
                            const r = (r2, n) => {
                              let o2 = "", a2 = Math.floor(r2 / 100), e2 = r2 % 100;
                              if (n || a2 > 0) { o2 += " " + t[a2] + " trÄƒm"; o2 += e2 === 0 ? "" : (e2 < 10 ? " láº»" : ""); }
                              let i2 = Math.floor(e2 / 10), m2 = e2 % 10;
                              if (i2 > 0) { o2 += i2 === 1 ? " mÆ°á»i" : " " + t[i2] + " mÆ°Æ¡i"; }
                              if (m2 > 0) {
                                if (m2 === 1 && i2 > 1) o2 += " má»‘t";
                                else if (m2 === 5 && i2 > 0) o2 += " lÄƒm";
                                else o2 += " " + t[m2];
                              }
                              return o2;
                            };
                            let isNegative = amount < 0;
                            let o2 = "", e2 = 0, num = Math.abs(amount);
                            do {
                              let ty = num % 1e9;
                              num = Math.floor(num / 1e9);
                              let i2 = ty > 0 ? ((num2, e3) => {
                                let resO = "", a3 = Math.floor(num2 / 1e6), n2 = num2 % 1e6;
                                if (a3 > 0) { resO += r(a3, e3) + " triá»‡u"; e3 = true; }
                                let idx2 = Math.floor(n2 / 1e3), m3 = n2 % 1e3;
                                if (idx2 > 0) { resO += r(idx2, e3) + " nghÃ¬n"; e3 = true; }
                                if (m3 > 0) resO += r(m3, e3);
                                return resO;
                              })(ty, num > 0) : "";
                              if (i2) o2 = i2 + (e2 > 0 ? " tá»·".repeat(e2) : "") + o2;
                              e2++;
                            } while (num > 0);
                            let res = o2.trim();
                            if (res.startsWith("láº» ")) res = res.substring(3);
                            if (isNegative) res = "Ã¢m " + res;
                            res = res.charAt(0).toUpperCase() + res.slice(1);
                            return res + " Ä‘á»“ng cháºµn./.";
                          })()}
                        </div>
                        </div>

                        <div style={{ padding: '15px 10px' }}>
                          <div>Thanh toÃ¡n 100% trÆ°á»›c khi xuáº¥t hÃ ng xuáº¥t táº¡i kho .</div>
                          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>TK THANH TOÃN:</div>
                          <div style={{ fontWeight: 'bold' }}>1. CÃ”NG TY: TÃªn TK: CÃ´ng Ty TNHH DV VIá»„N THÃ”NG Äá»¨C VINH</div>
                          <div style={{ fontWeight: 'bold' }}>TÃ i khoáº£n sá»‘ : 661000068 - NgÃ¢n hÃ ng ACB â€“ CN PhÃº LÃ¢m, Tp.HCM</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 40px 100px 40px' }}>
                          <div style={{ fontWeight: 'bold', textAlign: 'center', width: '200px' }}>XÃC NHáº¬N Cá»¦A KHÃCH HÃ€NG</div>
                          <div style={{ fontWeight: 'bold', textAlign: 'center', width: '200px' }}>Äáº I DIá»†N CÃ”NG TY</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* Operations & Interactive Elements in the modal */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex flex-wrap gap-3 items-center justify-between">
                  
                  {/* Status Toggle buttons inside view */}
                  <div className="space-y-1">
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Cáº­p nháº­t nhanh phÆ°Æ¡ng thá»©c thanh toÃ¡n</span>
                    <div className="flex gap-1.5 bg-white border rounded-lg p-1">
                      <button
                        onClick={() => handleChangeStatus(selectedInvoice.id, 'CTT')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${selectedInvoice.status === 'CTT' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        ChÆ°a thanh toÃ¡n
                      </button>
                      <button
                        onClick={() => handleChangeStatus(selectedInvoice.id, 'TM')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${selectedInvoice.status === 'TM' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Tiá»n máº·t
                      </button>
                      <button
                        onClick={() => handleChangeStatus(selectedInvoice.id, 'CK')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${selectedInvoice.status.startsWith('CK') ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Chuyá»ƒn khoáº£n
                      </button>
                    </div>
                  </div>

                                  {selectedInvoice.status.startsWith('CK') && (
                    <div className="flex gap-2 items-center mb-4 p-2 bg-blue-50/50 rounded-lg border border-blue-100 w-[385px]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">TÃ i khoáº£n nháº­n:</span>
                      <select
                        value={selectedInvoice.status.startsWith('CK - ') ? selectedInvoice.status.substring(5) : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleChangeStatus(selectedInvoice.id, val ? `CK - ${val}` : 'CK');
                        }}
                        className="px-2 py-1 text-xs border border-slate-200 rounded font-semibold text-slate-700 outline-none focus:border-blue-400 w-[300px]"
                      >
                        <option value="">-- TÃ¹y chá»n --</option>
                        {bankAccounts.map(b => {
                          const bankStr = `${b.bankName} - ${b.accountNumber} - ${b.accountName}`;
                          return <option key={b.id} value={bankStr}>{bankStr}</option>;
                        })}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2">
                    
                    {/* Add Deposit toggle */}
                    {selectedInvoice.depositEnabled && (
                      <button
                        onClick={() => setShowAddDeposit(!showAddDeposit)}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Coins className="w-4 h-4 text-emerald-600" />
                        <span>Thanh ToÃ¡n ThÃªm</span>
                      </button>
                    )}

                    {!selectedInvoice.isRecorded && (
                      <button
                        onClick={startEditing}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Sá»­a HÃ³a ÄÆ¡n</span>
                      </button>
                    )}

                    <button
                      onClick={handlePrint}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      <span>In HÃ³a ÄÆ¡n</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportDocumentToExcel(selectedInvoice, printType)}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                        <span>Xuáº¥t Excel</span>
                    </button>

                    <div className="flex-1 min-w-[20px]"></div>
                    <div className="w-px h-8 bg-slate-300 mx-1 hidden lg:block"></div>
                    <button
                      onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors lg:ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>XÃ³a HÃ³a ÄÆ¡n</span>
                    </button>
                  </div>

                </div>

                {/* Popover/Collapsible Add Deposit form */}
                {showAddDeposit && (
                  <form onSubmit={handleAddDepositPayment} className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3 animate-in slide-in-from-top-3 duration-100">
                    <h5 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase">
                      <Coins className="w-4 h-4 text-emerald-600" /> Thanh toÃ¡n thÃªm tá»« khÃ¡ch hÃ ng
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Sá»‘ tiá»n thanh toÃ¡n (VND)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="Sá»‘ tiá»n..."
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(Number(e.target.value))}
                          className="w-full px-3 py-1 bg-white border border-slate-200 rounded text-sm font-mono font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">PhÆ°Æ¡ng thá»©c nháº­n</label>
                        <select
                          value={depositMethod}
                          onChange={(e: any) => setDepositMethod(e.target.value)}
                          className="w-full px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold"
                        >
                          <option value="CK">Chuyá»ƒn khoáº£n (CK)</option>
                          <option value="TM">Tiá»n máº·t (TM)</option>
                        </select>
                        {depositMethod === 'CK' && (
                          <select
                            value={selectedDepositBankAccount}
                            onChange={(e) => setSelectedDepositBankAccount(e.target.value)}
                            className="w-full mt-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Chá»n tÃ i khoáº£n chuyá»ƒn --</option>
                            {bankAccounts.map(b => {
                              const bankStr = `${b.bankName} - ${b.accountNumber} - ${b.accountName}`;
                              return <option key={b.id} value={bankStr}>{bankStr}</option>;
                            })}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Ghi chÃº thanh toÃ¡n</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Thanh toÃ¡n Ä‘á»£t 2..."
                            value={depositNote}
                            onChange={(e) => setDepositNote(e.target.value)}
                            className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs"
                          />
                          <button
                            type="submit"
                            className="px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> LÆ°u
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}

                {/* Audit Trail Log History Section */}
                <div className="space-y-3">
                  <h4 className="font-display font-semibold text-slate-700 text-sm flex items-center gap-1.5 border-b pb-2">
                    <Clock className="w-4.5 h-4.5 text-slate-400" />
                    <span>Nháº­t kÃ½ hÃ³a Ä‘Æ¡n (Audit Trail Log)</span>
                  </h4>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50 rounded-lg p-3 border">
                    {selectedInvoice.logs && selectedInvoice.logs.length > 0 ? (
                      selectedInvoice.logs.map((log) => (
                        <div key={log.id} className="py-2.5 text-xs flex justify-between items-start gap-4">
                          <div className="space-y-0.5">
                            <span className="inline-block px-2 py-0.5 font-bold rounded text-[10px] bg-indigo-50 text-indigo-700 uppercase">
                              {log.action}
                            </span>
                            <p className="text-slate-600 font-medium">{log.details}</p>
                            <p className="text-slate-400 text-[10px]">NgÆ°á»i thá»±c hiá»‡n: <b>{log.userEmail}</b></p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {new Date(log.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-4">ChÆ°a cÃ³ nháº­t kÃ½ hoáº¡t Ä‘á»™ng nÃ o.</p>
                    )}
                  </div>
                </div>

              </div>
            )}
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
                <h3 className="text-lg font-bold text-slate-900">XÃ¡c nháº­n</h3>
                <p className="text-sm text-slate-500">{confirmDialog.message}</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  className="flex-1 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                  onClick={() => setConfirmDialog(null)}
                >
                  Há»§y
                </button>
                <button
                  type="button"
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                  onClick={confirmDialog.onConfirm}
                >
                  Äá»“ng Ã½
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal inside Edit flow */}
      {showNewCustModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display font-semibold text-slate-800">ThÃªm KhÃ¡ch HÃ ng Nhanh</h3>
              <button type="button" onClick={() => setShowNewCustModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">Ã—</button>
            </div>
            
            <form onSubmit={handleQuickAddCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">TÃªn KhÃ¡ch HÃ ng / Äáº¡i LÃ½</label>
                <input
                  type="text"
                  required
                  placeholder="VÃ­ dá»¥: Äáº¡i lÃ½ Äá»©c PhÃ¡t Solar"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sá»‘ Äiá»‡n Thoáº¡i</label>
                <input
                  type="text"
                  placeholder="VÃ­ dá»¥: 0987654321"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Äá»‹a Chá»‰ Giao HÃ ng</label>
                <input
                  type="text"
                  placeholder="VÃ­ dá»¥: Quáº­n 12, ThÃ nh phá»‘ Há»“ ChÃ­ Minh"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">MÃ£ Sá»‘ Thuáº¿ (Doanh nghiá»‡p)</label>
                <input
                  type="text"
                  placeholder="MÃ£ sá»‘ thuáº¿ doanh nghiá»‡p (náº¿u cÃ³)"
                  value={newCustTaxId}
                  onChange={(e) => setNewCustTaxId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Há»§y
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm flex items-center gap-1"
                >
                  LÆ°u KhÃ¡ch HÃ ng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Template Selection Modal */}
      {showTemplateSelectionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Chá»n HÃ³a ÄÆ¡n Máº«u</h3>
              <button onClick={() => setShowTemplateSelectionModal(false)} className="text-slate-500 hover:text-slate-700">ÄÃ³ng</button>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    handleCreateBlankInvoice();
                    setShowTemplateSelectionModal(false);
                  }}
                  className="w-full text-left p-3 border-2 border-emerald-500 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  <div className="font-bold text-emerald-800">+ Phiáº¿u Tráº¯ng</div>
                  <div className="text-xs text-emerald-600">Táº¡o hÃ³a Ä‘Æ¡n má»›i hoÃ n toÃ n</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

