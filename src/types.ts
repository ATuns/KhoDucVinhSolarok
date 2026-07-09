export interface User {
  id: number;
  uid: string;
  email: string;
  name?: string;
  photoUrl?: string;
  createdAt?: string;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  unit?: string;
  quantity: number;
  price: number;
  minStock: number;
  isHidden?: boolean;
  warehouseId?: number;
  warehouseCode?: string;
  warehouseName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  address?: string;
  note?: string;
  createdAt?: string;
}

export interface WarehouseStock {
  id: number;
  productId: number;
  warehouseId: number;
  quantity: number;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  taxId?: string;
  createdAt?: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  taxId?: string;
  createdAt?: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  documentCode: string;
  supplierId?: number;
  supplierName?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierTaxId?: string;
  status: 'CTT' | 'TM' | string;
  isRecorded: boolean;
  depositEnabled: boolean;
  totalAmount: number;
  totalDeposits?: number;
  createdByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: PurchaseOrderItem[];
  deposits?: PurchaseOrderDeposit[];
  logs?: PurchaseOrderLog[];
}

export interface PurchaseOrderItem {
  id: number;
  poId: number;
  productId: number;
  productName: string;
  productCode: string;
  unit: string;
  quantity: number;
  price: number;
  totalPrice: number;
  hasVat?: boolean;
  vatRate?: number;
  warehouseId?: number;
  warehouseCode?: string;
  warehouseName?: string;
}

export interface PurchaseOrderDeposit {
  id: number;
  poId: number;
  amount: number;
  paymentMethod: 'TM' | string;
  note?: string;
  createdAt: string;
}

export interface PurchaseOrderLog {
  id: number;
  poId: number;
  action: string;
  details: string;
  userEmail: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  documentCode: string;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxId?: string;
  status: 'CTT' | 'TM' | string;
  isRecorded: boolean;
  depositEnabled: boolean;
  totalAmount: number;
  totalDeposits?: number;
  createdByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: InvoiceItem[];
  deposits?: Deposit[];
  logs?: InvoiceLog[];
}

export interface InvoiceItem {
  id?: number;
  invoiceId?: number;
  productId?: number;
  productName: string;
  productCode: string;
  unit: string;
  quantity: number;
  price: number;
  totalPrice: number;
  hasVat?: boolean;
  vatRate?: number;
  warehouseId?: number;
  warehouseCode?: string;
  warehouseName?: string;
}

export interface Deposit {
  id: number;
  invoiceId: number;
  amount: number;
  paymentMethod: 'TM' | string;
  note?: string;
  createdAt: string;
}

export interface InvoiceLog {
  id: number;
  invoiceId: number;
  action: string;
  details: string;
  userEmail: string;
  createdAt: string;
}

export interface StockTransaction {
  id: number;
  productId: number;
  type: 'NHAP' | 'XUAT' | 'GHI_SO' | 'BO_GHI_SO';
  quantity: number;
  note?: string;
  userEmail: string;
  createdAt: string;
  partnerName?: string;
  docNumber?: string;
  unitPrice?: number;
  runningBalance?: number;
}

export function formatVND(value: number | string | undefined | null): string {
  const num = typeof value === 'number' ? value : Number(value || 0);
  if (isNaN(num)) return '0,00';
  let parts = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
  parts[0] = parts[0].replace(/,/g, '.');
  return parts.join(',');
}

export function formatQuantity(value: number | string | undefined | null): string {
  const num = typeof value === 'number' ? value : Number(value || 0);
  if (isNaN(num)) return '0';
  if (num % 1 === 0) {
    let parts = num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).split('.');
    parts[0] = parts[0].replace(/,/g, '.');
    return parts.join(',');
  } else {
    let parts = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
    parts[0] = parts[0].replace(/,/g, '.');
    return parts.join(',');
  }
}


export interface BankAccount {
  id: number;
  accountNumber: string;
  bankName: string;
  accountName: string;
  branch: string | null;
  createdAt: string;
}
