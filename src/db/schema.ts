import { integer, pgTable, serial, text, timestamp, boolean, bigint, doublePrecision, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users table (Firebase Auth linked)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Products table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(), // Mã sản phẩm
  name: text('name').notNull(), // Tên sản phẩm
  category: text('category').notNull(), // Loại/Danh mục
  unit: text('unit').notNull().default(''), // Đơn vị tính
  quantity: doublePrecision('quantity').notNull().default(0), // Số lượng hiện tại trong kho
  price: doublePrecision('price').notNull().default(0), // Đơn giá mặc định (VND)
  minStock: integer('min_stock').notNull().default(10), // Ngưỡng tồn kho thấp
  isHidden: boolean('is_hidden').notNull().default(false), // Ẩn vật tư
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. Customers table
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Invoices table
// Status can be: 'CTT' (Chưa thanh toán), 'TM' (Thanh toán tiền mặt), 'CK' (Chuyển khoản)
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull(), // Số hóa đơn (do người dùng sửa được)
  documentCode: text('document_code').notNull().unique(), // Mã chứng từ (tự động đổi theo trạng thái)
  customerId: integer('customer_id')
    .references(() => customers.id, { onDelete: 'set null' }),
  customCustomerName: text('custom_customer_name'), // Tên khách tạm thời cho hóa đơn
  status: text('status').notNull().default('CTT'), // 'CTT', 'TM', 'CK'
  bankAccountId: integer('bank_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  isRecorded: boolean('is_recorded').notNull().default(false), // Ghi sổ (Trang chờ = false, Thống kê = true)
  depositEnabled: boolean('deposit_enabled').notNull().default(false), // Cho phép cọc
  totalAmount: doublePrecision('total_amount').notNull().default(0), // Tổng tiền
  createdBy: integer('created_by')
    .references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

// 5. Invoice Items table
export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(), // Lưu tên lúc bán đề phòng sản phẩm bị xóa hoặc đổi tên
  productCode: text('product_code').notNull(),
  unit: text('unit').notNull().default(''), // Đơn vị tính
  quantity: doublePrecision('quantity').notNull(),
  price: doublePrecision('price').notNull(), // Giá bán thực tế (có thể chỉnh sửa rộng)
  totalPrice: doublePrecision('total_price').notNull(), // Thành tiền
  hasVat: boolean('has_vat').default(false),
  vatRate: integer('vat_rate').default(0),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
});

// 6. Deposits table (Cọc)
export const deposits = pgTable('deposits', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),
  amount: doublePrecision('amount').notNull(), // Số tiền cọc
  paymentMethod: text('payment_method').notNull(), // 'TM' hoặc 'CK'
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Invoice Logs (Nhật ký thay đổi hóa đơn)
export const invoiceLogs = pgTable('invoice_logs', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),
  action: text('action').notNull(), // e.g., 'TẠO MỚI', 'CHỈNH SỬA', 'GHI SỔ', 'BỎ GHI SỔ', 'ĐẶT CỌC', 'THAY ĐỔI TRẠNG THÁI'
  details: text('details').notNull(), // Mô tả thay đổi cụ thể
  userEmail: text('user_email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Stock Transactions (Nhật ký nhập/xuất kho vật lý)
export const stockTransactions = pgTable('stock_transactions', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(), // 'NHAP' (Nhập kho), 'XUAT' (Xuất kho thủ công), 'GHI_SO' (Trừ kho tự động khi ghi sổ), 'BO_GHI_SO' (Hoàn kho khi bỏ ghi sổ)
  quantity: doublePrecision('quantity').notNull(),
  note: text('note'),
  userEmail: text('user_email').notNull(),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }),
  docNumber: text('doc_number'),
  partnerName: text('partner_name'),
  unitPrice: doublePrecision('unit_price'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. Suppliers table
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. Purchase Orders (Nhập hàng)
export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  poNumber: text('po_number').notNull(), // Số phiếu nhập
  documentCode: text('document_code').notNull().unique(), // Mã chứng từ
  supplierId: integer('supplier_id')
    .references(() => suppliers.id, { onDelete: 'set null' }),
  customSupplierName: text('custom_supplier_name'), // Tên nhà cung cấp tạm thời
  status: text('status').notNull().default('CTT'), // 'CTT', 'TM', 'CK'
  bankAccountId: integer('bank_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  isRecorded: boolean('is_recorded').notNull().default(false), // Ghi sổ
  depositEnabled: boolean('deposit_enabled').notNull().default(false), // Cho phép cọc
  totalAmount: doublePrecision('total_amount').notNull().default(0), // Tổng tiền
  createdBy: integer('created_by')
    .references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

// 11. Purchase Order Items
export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: serial('id').primaryKey(),
  poId: integer('po_id')
    .references(() => purchaseOrders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(), 
  productCode: text('product_code').notNull(),
  unit: text('unit').notNull().default(''), // Đơn vị tính
  quantity: doublePrecision('quantity').notNull(),
  price: doublePrecision('price').notNull(), // Giá nhập thực tế
  totalPrice: doublePrecision('total_price').notNull(), // Thành tiền
  hasVat: boolean('has_vat').default(false),
  vatRate: integer('vat_rate').default(0),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
});

// 12. Purchase Order Deposits
export const purchaseOrderDeposits = pgTable('purchase_order_deposits', {
  id: serial('id').primaryKey(),
  poId: integer('po_id')
    .references(() => purchaseOrders.id, { onDelete: 'cascade' })
    .notNull(),
  amount: doublePrecision('amount').notNull(), // Số tiền cọc
  paymentMethod: text('payment_method').notNull(), // 'TM' hoặc 'CK'
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 13. Purchase Order Logs
export const purchaseOrderLogs = pgTable('purchase_order_logs', {
  id: serial('id').primaryKey(),
  poId: integer('po_id')
    .references(() => purchaseOrders.id, { onDelete: 'cascade' })
    .notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  userEmail: text('user_email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 14. Bank Accounts
export const bankAccounts = pgTable('bank_accounts', {
  id: serial('id').primaryKey(),
  accountNumber: text('account_number').notNull(),
  bankName: text('bank_name').notNull(),
  accountName: text('account_name').notNull(),
  branch: text('branch'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 15. Warehouses
export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  address: text('address'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 16. Warehouse Stocks
export const warehouseStocks = pgTable('warehouse_stocks', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  warehouseId: integer('warehouse_id')
    .references(() => warehouses.id, { onDelete: 'cascade' })
    .notNull(),
  quantity: doublePrecision('quantity').notNull().default(0),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  invoices: many(invoices),
  purchaseOrders: many(purchaseOrders),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  invoices: many(invoices),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  items: many(invoiceItems),
  deposits: many(deposits),
  logs: many(invoiceLogs),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  createdBy: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
  items: many(purchaseOrderItems),
  deposits: many(purchaseOrderDeposits),
  logs: many(purchaseOrderLogs),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.poId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderItems.productId],
    references: [products.id],
  }),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  invoice: one(invoices, {
    fields: [deposits.invoiceId],
    references: [invoices.id],
  }),
}));

export const purchaseOrderDepositsRelations = relations(purchaseOrderDeposits, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderDeposits.poId],
    references: [purchaseOrders.id],
  }),
}));

export const invoiceLogsRelations = relations(invoiceLogs, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLogs.invoiceId],
    references: [invoices.id],
  }),
}));

export const purchaseOrderLogsRelations = relations(purchaseOrderLogs, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderLogs.poId],
    references: [purchaseOrders.id],
  }),
}));

export const stockTransactionsRelations = relations(stockTransactions, ({ one }) => ({
  product: one(products, {
    fields: [stockTransactions.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [products.warehouseId],
    references: [warehouses.id],
  }),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  products: many(products),
}));
