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
        throw new Error("Không thể tải danh sách thống kê hóa đơn");
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
        throw new Error(errorData.error || "Lỗi khi tạo mới khách hàng");
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
        setSuccessMsg('Tạo hóa đơn mới từ mẫu thành công!');
        setIsEditing(false);
        setIsCreatingFromTemplate(false);
        loadInvoices();
        onInvoiceModified();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Tạo hóa đơn thất bại");
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
      alert("Hóa đơn phải có ít nhất một vật tư.");
      return;
    }

    const hasInvalidQty = editItems.some(itm => itm.quantity <= 0);
    if (hasInvalidQty) {
      alert("Số lượng của mỗi vật tư phải lớn hơn 0.");
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
        setSuccessMsg("Cập nhật hóa đơn thành công!");
        setIsEditing(false);
        loadInvoices();
        viewInvoiceDetail(selectedInvoice.id);
        onInvoiceModified();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Không thể cập nhật hóa đơn");
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
        throw new Error("Không thể lấy chi tiết hóa đơn");
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
        setSuccessMsg("Cập nhật trạng thái và tự động thay đổi mã chứng từ thành công!");
        loadInvoices();
        if (showDetailModal && selectedInvoice?.id === id) {
          viewInvoiceDetail(id); // Reload modal details
        }
        onInvoiceModified();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Không thể cập nhật trạng thái");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Record/Ghi sổ invoice
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
      loadInvoices();
      if (showDetailModal && selectedInvoice?.id === id) {
        viewInvoiceDetail(id);
      }
      onInvoiceModified();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Unrecord/Bỏ ghi sổ invoice
  const handleUnrecordInvoice = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      message: "Bỏ ghi sổ sẽ hoàn trả lại vật tư vào kho và chuyển hóa đơn về trạng thái chờ. Bạn có chắc chắn muốn bỏ ghi sổ?",
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
            throw new Error(errData.error || "Bỏ ghi sổ thất bại");
          }

          const result = await res.json();
          setSuccessMsg(result.message || "Bỏ ghi sổ thành công!");
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

  // Duplicate Invoice (Nhân bản)
  const handleDuplicateInvoice = async (id: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetchWithAuth(`/api/invoices/${id}/duplicate`, {
        method: 'POST'
      });

      if (res.ok) {
        const result = await res.json();
        setSuccessMsg(`Nhân bản hóa đơn nháp thành công! Đơn mới #${result.invoiceNumber} đã được thêm vào Trang Chờ.`);
        loadInvoices();
        onInvoiceModified();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Nhân bản thất bại");
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
      message: "Bạn có chắc chắn muốn chuyển hóa đơn này vào thùng rác?",
      onConfirm: async () => {
        setConfirmDialog(null);
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await fetchWithAuth(`/api/invoices/${id}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            setSuccessMsg("Đã chuyển hóa đơn vào thùng rác!");
            setShowDetailModal(false);
            loadInvoices();
            onInvoiceModified();
          } else {
            const errData = await res.json();
            throw new Error(errData.error || "Xóa hóa đơn thất bại");
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
        setSuccessMsg(`Đã nhận cọc thêm ${formatVND(depositAmount)} đ thành công!`);
        setShowAddDeposit(false);
        setDepositAmount(0);
        setDepositNote('');
        viewInvoiceDetail(selectedInvoice.id); // reload
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Ghi nhận cọc thất bại");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Helper for status styling
  const getStatusBadge = (status: string) => {
    if (status === 'CTT') {
      return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-red-50 text-red-700 border border-red-200">CHƯA THANH TOÁN</span>;
    }
    if (status === 'TM') {
      return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">TIỀN MẶT</span>;
    }
    if (status === 'CK' || (status && status.startsWith('CK'))) {
      return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">CHUYỂN KHOẢN</span>;
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
            <title>In hóa đơn</title>
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
          <h1 className="font-display text-base font-bold tracking-tight text-slate-900">Sổ Thống Kê Hóa Đơn</h1>
          <p className="text-xs text-slate-500">Xem báo cáo, sao chép, in ấn và quản lý trạng thái xuất kho ghi sổ</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                setLoading(true);
                const res = await fetchWithAuth('/api/invoices/create-blank', {
                  method: 'POST',
                });
                if (!res.ok) throw new Error("Không thể tạo hóa đơn mới");
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
            Tạo Hóa Đơn Trắng
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
            placeholder="Tìm theo mã chứng từ, số hóa đơn, khách hàng..."
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
            <span className="text-[10px] font-bold text-slate-500 uppercase">Từ</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => {
                setFilterStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 text-xs text-slate-700 bg-transparent border-0 focus:outline-none"
            />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Đến</span>
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
            <option value="">-- Trạng thái thanh toán --</option>
            <option value="CTT">Chưa thanh toán</option>
            <option value="TM">Tiền mặt</option>
            <option value="CK">Chuyển khoản</option>
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
            <option value="">-- Trạng thái ghi sổ --</option>
            <option value="true">Đã ghi sổ (Trừ kho)</option>
            <option value="false">Chưa ghi sổ (Trang chờ)</option>
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
            <option value="desc">Mới nhất tới cũ nhất</option>
            <option value="asc">Cũ nhất tới mới nhất</option>
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
              <span>Reset bộ lọc</span>
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
                <th className="px-3 py-2.5">Tên Khách</th>
                <th className="px-3 py-2.5">Mã số thuế</th>
                <th className="px-3 py-2.5">Số chứng từ</th>
                <th className="px-3 py-2.5">Số Hóa đơn</th>
                <th className="px-3 py-2.5">Ngày</th>
                <th className="px-3 py-2.5 text-right">Thành tiền</th>
                <th className="px-3 py-2.5">Trạng thái</th>
                <th className="px-3 py-2.5 text-center">Chức Năng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-500" />
                    <span className="text-xs font-semibold">Đang tải danh sách hóa đơn...</span>
                  </td>
                </tr>
              ) : invoiceList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400 font-semibold">
                    Không tìm thấy hóa đơn nào trong cơ sở dữ liệu.
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
                        {inv.customerName || 'Khách vãng lai'}
                      </div>
                      {inv.customerPhone && (
                        <div className="text-[10px] text-slate-400 font-mono">SĐT: {inv.customerPhone}</div>
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
                      {formatVND(inv.depositEnabled ? Number(inv.totalAmount || 0) - Number(inv.totalDeposits || 0) : Number(inv.totalAmount || 0))} đ
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
                          title="Xem chi tiết & logs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem</span>
                        </button>

                        <button
                          onClick={() => handleDuplicateInvoice(inv.id)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center gap-0.5 text-[11px] font-bold cursor-pointer"
                          title="Nhân bản hóa đơn này"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Nhân bản</span>
                        </button>

                        {/* Toggle Recording (Post/Unpost) */}
                        {inv.isRecorded ? (
                          <button
                            onClick={() => handleUnrecordInvoice(inv.id)}
                            className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 text-[11px] font-bold rounded border border-amber-200 transition-colors cursor-pointer"
                            title="Bỏ ghi sổ hoàn trả lại hàng vào kho"
                          >
                            Bỏ Ghi Sổ
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRecordInvoice(inv.id)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded transition-colors cursor-pointer"
                            title="Ghi sổ trừ kho thiết bị"
                          >
                            Ghi Sổ
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
                      <span className="text-indigo-700 font-bold uppercase tracking-wider text-[10px]">Tổng số phiếu đã lọc:</span>
                      <span className="font-mono font-black text-indigo-700 text-xs">{totalInvoicesCount}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100 flex flex-col items-end shrink-0">
                      <span className="text-indigo-700 font-bold uppercase tracking-wider text-[9px] whitespace-nowrap">Tổng tiền được lọc:</span>
                      <span className="font-mono font-black text-indigo-700 text-sm whitespace-nowrap">{formatVND(totalAmountSum)} đ</span>
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
                  {isEditing ? (isCreatingFromTemplate ? "Tạo Hóa Đơn Mới" : "Chỉnh Sửa Hóa Đơn") : "Hồ Sơ Hóa Đơn Chi Tiết"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEditing 
                    ? "Cập nhật vật tư, đơn giá, số lượng và đối tác trước khi ghi sổ" 
                    : `Số: ${selectedInvoice?.invoiceNumber} • Chứng từ: ${selectedInvoice?.documentCode}`}
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
                ×
              </button>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <span>Đang tải thông tin...</span>
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
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Thông Tin Chung</h4>
                      
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Số hóa đơn</label>
                        <input
                          type="text"
                          placeholder="Để trống sẽ mặc định là 0"
                          value={editInvoiceNumber}
                          onChange={(e) => setEditInvoiceNumber(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Ngày tạo hóa đơn</label>
                        <input
                          type="datetime-local"
                          value={editCreatedAt}
                          onChange={(e) => setEditCreatedAt(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Hình thức thanh toán</label>
                        <select
                          value={editStatus}
                          onChange={(e: any) => setEditStatus(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                        >
                          <option value="CTT">Chưa thanh toán</option>
                          <option value="TM">Tiền mặt</option>
                          <option value="CK">Chuyển khoản</option>
                        </select>
                      </div>

                      {editStatus === 'CK' && (
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Tài khoản nhận</label>
                          <select
                            value={editBankAccountId}
                            onChange={(e) => setEditBankAccountId(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold"
                          >
                            <option value="">-- Chọn tài khoản --</option>
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
                          Kích hoạt thanh toán nhiều lần
                        </label>
                      </div>
                    </div>

                    {/* Customer search field */}
                    <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 relative">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Khách Hàng / Đối Tác</h4>
                      
                      <div className="relative">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[10px] text-slate-500 font-semibold uppercase">Tìm kiếm khách hàng</label>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCustName(customerSearch);
                              setShowNewCustModal(true);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                          >
                            <UserPlus className="w-2.5 h-2.5" /> Thêm mới
                          </button>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Nhập tên, số điện thoại hoặc MST..."
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
                              ×
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
                                  <Plus className="w-3.5 h-3.5" /> + Tạo mới: "{customerSearch}"
                                </div>
                              )}
                              <div 
                                onClick={() => {
                                  setEditCustomer(null);
                                  setCustomerSearch('Khách hàng vãng lai');
                                  setShowCustomerDropdown(false);
                                }}
                                className="p-2 text-xs text-slate-500 hover:bg-indigo-50 cursor-pointer font-semibold"
                              >
                                -- Khách hàng vãng lai --
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
                                <div className="p-2 text-xs text-slate-400 italic">Không tìm thấy khách hàng nào.</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {editCustomer && (
                        <div className="p-2.5 bg-white rounded border text-xs space-y-1">
                          <div className="font-bold text-slate-800">{editCustomer.name}</div>
                          {editCustomer.phone && <div className="text-slate-500 font-mono">SĐT: {editCustomer.phone}</div>}
                          {editCustomer.address && <div className="text-slate-400 text-[11px] leading-tight">ĐC: {editCustomer.address}</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Search & Items List */}
                  <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Danh Sách Thiết Bị / Vật Tư</h4>

                    {/* Product Autocomplete Input */}
                    <div className="relative">
                      <div className="flex gap-2 mb-1">
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Thêm thiết bị vào hóa đơn</label>
                        </div>
                        <div className="w-1/3">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Chọn Kho (Bắt buộc)
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 relative">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder={selectedWarehouseId ? "Tìm theo tên vật tư, mã thiết bị, danh mục..." : "Vui lòng chọn kho trước để tìm kiếm..."}
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
                            <option value="">-- Chọn Kho --</option>
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
                                  <div className="text-[12px] text-black font-mono">Mã: {prod.code} | Kho: {prod.warehouseName} | Tồn: {formatQuantity(prod.quantity)} {prod.unit || 'chiếc'}</div>
                                </div>
                                <span className="text-indigo-600 font-mono text-xs font-bold">
                                  {formatVND(prod.price)} đ
                                </span>
                              </div>
                            )})}
                            {filteredProducts.length === 0 && (
                              <div className="p-2 text-xs text-slate-400 italic">Không tìm thấy thiết bị nào phù hợp.</div>
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
                            <th className="py-2 px-3">Tên Vật Tư / Thiết Bị</th>
                            <th className="py-2 px-3 text-center w-16">ĐVT</th>
                            <th className="py-2 px-3 text-center w-24">Số Lượng</th>
                            <th className="py-2 px-3 text-right w-32">Đơn Giá (đ)</th>
                            <th className="py-2 px-3 text-right w-32">Thành Tiền</th>
                            <th className="py-2 px-3 text-center w-12">×</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {editItems.map((item, idx) => {
                            const baseTotal = item.quantity * item.price;
                            const preVatTotal = item.hasVat && item.vatRate ? (baseTotal / (1 + item.vatRate / 100)) : baseTotal;
                            
                            const w = warehouses.find(wh => wh.id === item.warehouseId);
                            const wName = w ? w.name : 'Chưa chọn kho';
                            
                            return (
                              <tr key={idx}>
                                <td className="py-2 px-3 align-top">
                                  <input
                                    type="text"
                                    value={item.productName || ''}
                                    onChange={(e) => handleUpdateEditProductName(idx, e.target.value)}
                                    placeholder="Tên vật tư / thiết bị..."
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
                                    placeholder="ĐVT..."
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
                                    {formatVND(item.totalPrice)} đ
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
                                      Trước VAT: {formatVND(preVatTotal)} đ
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
                                Chưa có vật tư nào được chọn. Hãy dùng ô tìm kiếm ở trên để thêm thiết bị.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Total math */}
                    <div className="flex flex-col items-end gap-1 border-t border-slate-200 pt-3">
                      <div className="flex justify-between items-center w-full max-w-xs text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Tổng thành tiền (trước VAT):</span>
                        <span className="text-xs font-mono text-slate-600">
                          {formatVND(editItems.reduce((acc, item) => acc + (item.hasVat && item.vatRate ? ((item.quantity * item.price) / (1 + item.vatRate / 100)) : item.quantity * item.price), 0))} đ
                        </span>
                      </div>
                      <div className="flex justify-between items-center w-full max-w-xs text-right">
                        <span className="text-xs font-bold text-slate-800 uppercase">Tổng cộng tiền hàng:</span>
                        <span className="text-sm font-black text-indigo-600 font-mono">
                          {formatVND(calculateEditTotal())} đ
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
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Thông Tin Thanh Toán (Đợt thanh toán)</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditDeposits([...editDeposits, {
                              id: 0,
                              invoiceId: selectedInvoice?.id || 0,
                              amount: 0,
                              paymentMethod: 'CK',
                              note: `Khách thanh toán lần thứ ${editDeposits.length + 1}`,
                              createdAt: new Date().toISOString()
                            }]);
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Thêm đợt thanh toán
                        </button>
                      </div>

                      {editDeposits.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Chưa có thông tin thanh toán nào được ghi nhận cho hóa đơn này.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {editDeposits.map((dep, dIdx) => (
                            <div key={dIdx} className="bg-white p-2 border border-slate-200 rounded-md flex flex-wrap md:flex-nowrap gap-2 items-center justify-between">
                              <span className="text-xs font-bold text-slate-500">Đợt {dIdx + 1}</span>
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-[8px] font-bold text-slate-400 uppercase">Số tiền thanh toán</label>
                                <PriceInput
                                  value={dep.amount}
                                  onChange={(val) => {
                                    const updated = [...editDeposits];
                                    updated[dIdx].amount = val;
                                    setEditDeposits(updated);
                                  }}
                                  className="w-full px-1.5 py-0.5 border text-right font-bold text-slate-800 rounded text-xs font-mono bg-slate-50 focus:bg-white"
                                  placeholder="Số tiền..."
                                />
                              </div>
                              <div className="w-28 shrink-0">
                                <label className="block text-[8px] font-bold text-slate-400 uppercase">Phương thức</label>
                                <select
                                  value={dep.paymentMethod.startsWith('CK') ? 'CK' : dep.paymentMethod}
                                  onChange={(e) => {
                                    const updated = [...editDeposits];
                                    updated[dIdx].paymentMethod = e.target.value;
                                    setEditDeposits(updated);
                                  }}
                                  className="w-full px-1.5 py-0.5 border text-xs font-semibold rounded text-slate-700 bg-slate-50 focus:bg-white"
                                >
                                  <option value="CK">Chuyển khoản</option>
                                  <option value="TM">Tiền mặt</option>
                                </select>
                              </div>
                              <div className="flex-1 min-w-[150px]">
                                <label className="block text-[8px] font-bold text-slate-400 uppercase">Ghi chú</label>
                                <input
                                  type="text"
                                  value={dep.note || ''}
                                  onChange={(e) => {
                                    const updated = [...editDeposits];
                                    updated[dIdx].note = e.target.value;
                                    setEditDeposits(updated);
                                  }}
                                  placeholder="Ghi chú (Khách thanh toán...)"
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
                      Hủy Bỏ
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
                      <span>{isCreatingFromTemplate ? "Thêm Mới" : "Lưu Thay Đổi"}</span>
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
                    Phiếu tiêu chuẩn (Không VAT)
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
                    Phiếu chi tiết VAT (Có Trước VAT)
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
                    Biên bản bàn giao
                  </button>
                </div>

                {/* Printable Invoice Area (Clean corporate style matching exact reqs) */}
                <div id="printable_invoice_area" className="border border-slate-200 rounded-lg p-6 bg-white text-slate-800 overflow-x-auto">
                  <div style={{ fontFamily: '"Times New Roman", Times, serif', margin: '0 auto', maxWidth: '800px', fontSize: '14px', lineHeight: '1.4', color: 'black' }}>
                    {printType === 'delivery' ? (
                      <div style={{ padding: '10px 0' }}>
                        {/* Company Header matching image */}
                        <div style={{ marginBottom: '25px', fontFamily: '"Times New Roman", Times, serif' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '15px', textTransform: 'uppercase' }}>CÔNG TY TRÁCH NHIỆM HỮU HẠN DỊCH VỤ VIỄN THÔNG ĐỨC VINH</div>
                          <div style={{ fontSize: '14px' }}>137 Đường Thới Tam Thôn 9, Xã Đông Thạnh, Thành phố Hồ Chí Minh, Việt Nam.</div>
                        </div>

                        {/* Title Section */}
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '22px', letterSpacing: '0.5px' }}>BIÊN BẢN BÀN GIAO</div>
                          <div style={{ fontSize: '14px', fontStyle: 'italic' }}>
                            Ngày {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getDate()).padStart(2, '0') : '...'} tháng {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getMonth() + 1).padStart(2, '0') : '...'} năm {selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).getFullYear() : '...'} tại
                          </div>
                        </div>

                        {/* Party Information */}
                        <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '15px' }}>
                          <div>
                            <strong>Đại diện bên nhận (Bên A):</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{selectedInvoice.customerName || "...................................................."}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ width: '50%' }}>Ông (Bà): ....................................................</span>
                            <span style={{ width: '50%' }}>Chức vụ: ....................................................</span>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <strong>Đại diện bên giao (Bên B):</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>CÔNG TY TRÁCH NHIỆM HỮU HẠN DỊCH VỤ VIỄN THÔNG ĐỨC VINH</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ width: '50%' }}>Ông (Bà): ....................................................</span>
                            <span style={{ width: '50%' }}>Chức vụ: ....................................................</span>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            Ngày {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getDate()).padStart(2, '0') : '...'} tháng {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getMonth() + 1).padStart(2, '0') : '...'} năm {selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).getFullYear() : '...'} tại
                          </div>
                          <div style={{ fontWeight: 'bold', marginTop: '6px' }}>
                            Hai bên cùng nhau bàn giao hàng hoá chi tiết như sau:
                          </div>
                        </div>

                        {/* Items Table matching exact structure of the image */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                          <thead>
                            <tr>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', width: '40px', fontWeight: 'bold' }}>STT</th>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>Tên hàng</th>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', width: '90px', fontWeight: 'bold' }}>Đơn vị tính</th>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', width: '90px', fontWeight: 'bold' }}>Số lượng</th>
                              <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', width: '180px', fontWeight: 'bold' }}>Chất lượng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedInvoice.items?.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ border: '1px solid black', padding: '6px' }}>{item.productName}</td>
                                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.unit || "Cái"}</td>
                                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{formatQuantity(item.quantity)}</td>
                                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>Tốt</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Warranty Information */}
                        <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '35px' }}>
                          <div>Về chất lượng hàng hóa và phụ kiện: Hàng hoá được cung cấp mới 100%.</div>
                          <div>Biên bản này được lập thành 02 (hai) bản có giá trị như nhau, mỗi bên giữ 01 (một) bản để cùng thực hiện.</div>
                        </div>

                        {/* Signatures */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 40px 100px 40px', fontSize: '14px' }}>
                          <div style={{ textAlign: 'center', width: '250px' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>ĐẠI DIỆN BÊN NHẬN</div>
                            <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#555' }}>(Ký, họ tên)</div>
                          </div>
                          <div style={{ textAlign: 'center', width: '250px' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>ĐẠI DIỆN BÊN GIAO</div>
                            <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#555' }}>(Ký, họ tên)</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ border: '1px solid black' }}>
                        <div style={{ textAlign: 'center', borderBottom: '1px solid black', padding: '10px' }}>
                          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '18px' }}>CÔNG TY TNHH DỊCH VỤ VIỄN THÔNG ĐỨC VINH</div>
                          <div>Địa chỉ: 137 Đường Thới Tam Thôn 9, Xã Thới Tam Thôn, Huyện Hóc Môn, TP.Hồ Chí Minh</div>
                          <div>MST: 0311193770</div>
                          <div>Hotline: 0938288876-0915877739.</div>
                          <div>FB: DUCVINHSOLAR-Website: Ducvinhsolar.com</div>
                        </div>
                        
                        <div style={{ textAlign: 'center', padding: '15px 15px 5px 15px' }}>
                          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '22px', marginBottom: '5px' }}>BẢNG BÁO GIÁ</div>
                          <div style={{ fontSize: '14px', fontStyle: 'italic' }}>Ngày {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getDate()).padStart(2, '0') : '...'} tháng {selectedInvoice.createdAt ? String(new Date(selectedInvoice.createdAt).getMonth() + 1).padStart(2, '0') : '...'} năm {selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).getFullYear() : '...'}</div>
                          <div style={{ fontSize: '14px', marginBottom: '15px' }}>Số: {selectedInvoice.documentCode}</div>
                        </div>
                        
                        <div style={{ padding: '0 15px 15px 15px', borderBottom: '1px solid black' }}>
                          <div style={{ fontSize: '14px', marginBottom: '3px' }}><strong>Tên khách hàng:</strong> {selectedInvoice.customerName || "...................................................."}</div>
                          <div style={{ fontSize: '14px', marginBottom: '3px' }}><strong>Địa chỉ:</strong> {selectedInvoice.customerAddress || "...................................................."}</div>
                          <div style={{ fontSize: '14px', marginBottom: '3px' }}><strong>Số điện thoại:</strong> {selectedInvoice.customerPhone || "...................................................."}</div>
                          <div style={{ fontSize: '14px' }}><strong>Mã số thuế:</strong> {selectedInvoice.customerTaxId || "...................................................."}</div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            {printType === 'vat' ? (
                              <tr>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '40px' }}>STT</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '100px' }}>Mã sản phẩm</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>Tên thiết bị</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '60px' }}>Đơn vị</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '60px' }}>Số lượng</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '90px' }}>Đơn giá</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '50px' }}>VAT</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '100px' }}>Trước VAT</th>
                                <th style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'center', width: '110px' }}>Thành tiền</th>
                              </tr>
                            ) : (
                              <tr>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '40px' }}>STT</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '100px' }}>Mã sản phẩm</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>Tên thiết bị</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '80px' }}>Đơn vị</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '80px' }}>Số lượng</th>
                                <th style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center', width: '100px' }}>Đơn giá</th>
                                <th style={{ borderBottom: '1px solid black', padding: '6px', textAlign: 'center', width: '120px' }}>Thành tiền</th>
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
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.unit || "Cái"}</td>
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
                                      <span style={{ fontWeight: 'bold' }}>TỔNG CỘNG TIỀN HÀNG (TRƯỚC VAT)</span>
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
                                      <span style={{ fontWeight: 'bold' }}>TỔNG TIỀN THUẾ GTGT (VAT)</span>
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
                                      <span style={{ fontWeight: 'bold' }}>TỔNG CỘNG TIỀN THANH TOÁN</span>
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
                                            <span style={{ fontWeight: 'bold' }}>{dep.note || `Khách thanh toán lần thứ ${depIdx + 1}`}</span>
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
                                          <span style={{ fontWeight: 'bold' }}>CÒN LẠI CẦN THANH TOÁN</span>
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
                                      <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.unit || "Cái"}</td>
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
                                      <span style={{ fontWeight: 'bold' }}>TỔNG CỘNG</span>
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
                                            <span style={{ fontWeight: 'bold' }}>{dep.note || `Khách thanh toán lần thứ ${depIdx + 1}`}</span>
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
                                          <span style={{ fontWeight: 'bold' }}>CÒN LẠI CẦN THANH TOÁN</span>
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
                          Bằng chữ: {(() => {
                            const totalInvoiceAmount = selectedInvoice.items?.reduce((acc, item) => acc + (item.quantity * item.price), 0) || 0;
                            const totalDepositsAmount = selectedInvoice.depositEnabled ? (selectedInvoice.deposits?.reduce((acc, d) => acc + d.amount, 0) || 0) : 0;
                            const amount = totalInvoiceAmount - totalDepositsAmount;
                            if (amount === 0) return "Không đồng chẵn./.";
                            const t = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
                            const r = (r2, n) => {
                              let o2 = "", a2 = Math.floor(r2 / 100), e2 = r2 % 100;
                              if (n || a2 > 0) { o2 += " " + t[a2] + " trăm"; o2 += e2 === 0 ? "" : (e2 < 10 ? " lẻ" : ""); }
                              let i2 = Math.floor(e2 / 10), m2 = e2 % 10;
                              if (i2 > 0) { o2 += i2 === 1 ? " mười" : " " + t[i2] + " mươi"; }
                              if (m2 > 0) {
                                if (m2 === 1 && i2 > 1) o2 += " mốt";
                                else if (m2 === 5 && i2 > 0) o2 += " lăm";
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
                                if (a3 > 0) { resO += r(a3, e3) + " triệu"; e3 = true; }
                                let idx2 = Math.floor(n2 / 1e3), m3 = n2 % 1e3;
                                if (idx2 > 0) { resO += r(idx2, e3) + " nghìn"; e3 = true; }
                                if (m3 > 0) resO += r(m3, e3);
                                return resO;
                              })(ty, num > 0) : "";
                              if (i2) o2 = i2 + (e2 > 0 ? " tỷ".repeat(e2) : "") + o2;
                              e2++;
                            } while (num > 0);
                            let res = o2.trim();
                            if (res.startsWith("lẻ ")) res = res.substring(3);
                            if (isNegative) res = "âm " + res;
                            res = res.charAt(0).toUpperCase() + res.slice(1);
                            return res + " đồng chẵn./.";
                          })()}
                        </div>
                        </div>

                        <div style={{ padding: '15px 10px' }}>
                          <div>Thanh toán 100% trước khi xuất hàng xuất tại kho .</div>
                          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>TK THANH TOÁN:</div>
                          <div style={{ fontWeight: 'bold' }}>1. CÔNG TY: Tên TK: Công Ty TNHH DV VIỄN THÔNG ĐỨC VINH</div>
                          <div style={{ fontWeight: 'bold' }}>Tài khoản số : 661000068 - Ngân hàng ACB – CN Phú Lâm, Tp.HCM</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 40px 100px 40px' }}>
                          <div style={{ fontWeight: 'bold', textAlign: 'center', width: '200px' }}>XÁC NHẬN CỦA KHÁCH HÀNG</div>
                          <div style={{ fontWeight: 'bold', textAlign: 'center', width: '200px' }}>ĐẠI DIỆN CÔNG TY</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* Operations & Interactive Elements in the modal */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex flex-wrap gap-3 items-center justify-between">
                  
                  {/* Status Toggle buttons inside view */}
                  <div className="space-y-1">
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Cập nhật nhanh phương thức thanh toán</span>
                    <div className="flex gap-1.5 bg-white border rounded-lg p-1">
                      <button
                        onClick={() => handleChangeStatus(selectedInvoice.id, 'CTT')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${selectedInvoice.status === 'CTT' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Chưa thanh toán
                      </button>
                      <button
                        onClick={() => handleChangeStatus(selectedInvoice.id, 'TM')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${selectedInvoice.status === 'TM' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Tiền mặt
                      </button>
                      <button
                        onClick={() => handleChangeStatus(selectedInvoice.id, 'CK')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${selectedInvoice.status.startsWith('CK') ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Chuyển khoản
                      </button>
                    </div>
                  </div>

                  {selectedInvoice.status.startsWith('CK') && (
                    <div className="flex gap-2 items-center mb-4 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Tài khoản nhận:</span>
                      <select
                        value={selectedInvoice.status.startsWith('CK - ') ? selectedInvoice.status.substring(5) : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleChangeStatus(selectedInvoice.id, val ? `CK - ${val}` : 'CK');
                        }}
                        className="px-2 py-1 text-xs border border-slate-200 rounded font-semibold text-slate-700 outline-none focus:border-blue-400"
                      >
                        <option value="">-- Tùy chọn --</option>
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
                        <span>Thanh Toán Thêm</span>
                      </button>
                    )}

                    {!selectedInvoice.isRecorded && (
                      <button
                        onClick={startEditing}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Sửa Hóa Đơn</span>
                      </button>
                    )}

                    <button
                      onClick={handlePrint}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      <span>In Hóa Đơn</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportDocumentToExcel(selectedInvoice, printType)}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Xuất Excel</span>
                    </button>

                    <button
                      onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa Hóa Đơn</span>
                    </button>
                  </div>

                </div>

                {/* Popover/Collapsible Add Deposit form */}
                {showAddDeposit && (
                  <form onSubmit={handleAddDepositPayment} className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3 animate-in slide-in-from-top-3 duration-100">
                    <h5 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase">
                      <Coins className="w-4 h-4 text-emerald-600" /> Thanh toán thêm từ khách hàng
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Số tiền thanh toán (VND)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="Số tiền..."
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(Number(e.target.value))}
                          className="w-full px-3 py-1 bg-white border border-slate-200 rounded text-sm font-mono font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Phương thức nhận</label>
                        <select
                          value={depositMethod}
                          onChange={(e: any) => setDepositMethod(e.target.value)}
                          className="w-full px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold"
                        >
                          <option value="CK">Chuyển khoản (CK)</option>
                          <option value="TM">Tiền mặt (TM)</option>
                        </select>
                        {depositMethod === 'CK' && (
                          <select
                            value={selectedDepositBankAccount}
                            onChange={(e) => setSelectedDepositBankAccount(e.target.value)}
                            className="w-full mt-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Chọn tài khoản chuyển --</option>
                            {bankAccounts.map(b => {
                              const bankStr = `${b.bankName} - ${b.accountNumber} - ${b.accountName}`;
                              return <option key={b.id} value={bankStr}>{bankStr}</option>;
                            })}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Ghi chú thanh toán</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Thanh toán đợt 2..."
                            value={depositNote}
                            onChange={(e) => setDepositNote(e.target.value)}
                            className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs"
                          />
                          <button
                            type="submit"
                            className="px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Lưu
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
                    <span>Nhật ký hóa đơn (Audit Trail Log)</span>
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
                            <p className="text-slate-400 text-[10px]">Người thực hiện: <b>{log.userEmail}</b></p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {new Date(log.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-4">Chưa có nhật ký hoạt động nào.</p>
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

      {/* Quick Add Customer Modal inside Edit flow */}
      {showNewCustModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display font-semibold text-slate-800">Thêm Khách Hàng Nhanh</h3>
              <button type="button" onClick={() => setShowNewCustModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            
            <form onSubmit={handleQuickAddCustomer} className="p-5 space-y-4">
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono"
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mã Số Thuế (Doanh nghiệp)</label>
                <input
                  type="text"
                  placeholder="Mã số thuế doanh nghiệp (nếu có)"
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
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm flex items-center gap-1"
                >
                  Lưu Khách Hàng
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
              <h3 className="font-bold text-slate-800">Chọn Hóa Đơn Mẫu</h3>
              <button onClick={() => setShowTemplateSelectionModal(false)} className="text-slate-500 hover:text-slate-700">Đóng</button>
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
                  <div className="font-bold text-emerald-800">+ Phiếu Trắng</div>
                  <div className="text-xs text-emerald-600">Tạo hóa đơn mới hoàn toàn</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

