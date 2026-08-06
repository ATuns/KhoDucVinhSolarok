import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db, detectUnaccentSupport, getIsUnaccentSupported } from "./src/db/index.ts";
import {
  users,
  products,
  customers,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderDeposits,
  purchaseOrderLogs,
  invoices,
  invoiceItems,
  deposits,
  invoiceLogs,
  stockTransactions,
  bankAccounts,
  warehouses,
  warehouseStocks
} from "./src/db/schema.ts";
import { eq, like, and, or, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { purchaseOrdersRouter } from "./src/routes/purchaseOrders.ts";
import { debtsRouter } from "./src/routes/debts.ts";
import * as xlsx from "xlsx";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Ensure unaccent extension is created in the database
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS unaccent;`);
    console.log("Database extension 'unaccent' ensured successfully.");
  } catch (error) {
    console.error("Failed to ensure 'unaccent' extension on startup:", error);
  }

  // Ensure columns are double precision
  try {
    await db.execute(sql`ALTER TABLE invoice_items ALTER COLUMN price TYPE double precision;`);
    await db.execute(sql`ALTER TABLE invoice_items ALTER COLUMN total_price TYPE double precision;`);
    await db.execute(sql`ALTER TABLE purchase_order_items ALTER COLUMN price TYPE double precision;`);
    await db.execute(sql`ALTER TABLE purchase_order_items ALTER COLUMN total_price TYPE double precision;`);
    await db.execute(sql`ALTER TABLE products ALTER COLUMN price TYPE double precision;`);
    await db.execute(sql`ALTER TABLE invoices ALTER COLUMN total_amount TYPE double precision;`);
    await db.execute(sql`ALTER TABLE purchase_orders ALTER COLUMN total_amount TYPE double precision;`);
    console.log("Altered tables to double precision successfully.");
  } catch (error) {
    console.error("Failed to alter tables:", error);
  }

  // Detect unaccent support dynamically
  await detectUnaccentSupport();

  app.use(express.json({ limit: '50mb' }));

  app.use("/api", purchaseOrdersRouter);
  app.use("/api", debtsRouter);

  // ---------------------------------------------------------------------------
  // HELPER FUNCTIONS
  // ---------------------------------------------------------------------------
  
  function updateCodeWithNewDate(code: string | null | undefined, newDate: Date): string {
    if (!code) return "";
    const parts = code.split('-');
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newDate.getDate()).padStart(2, '0');
    const yyyymmdd = `${yyyy}${mm}${dd}`;
    const yymmdd = `${String(yyyy).slice(-2)}${mm}${dd}`;

    if (parts.length === 3) {
      const prefix = parts[0];
      if (prefix === 'TM' || prefix === 'CK') {
        parts[1] = yymmdd;
      } else {
        parts[1] = yyyymmdd;
      }
    } else if (parts.length === 4) {
      const type = parts[1];
      if (type === 'TM' || type === 'CK') {
        parts[2] = yymmdd;
      } else {
        parts[2] = yyyymmdd;
      }
    }
    return parts.join('-');
  }
  
  // Generate code and number for a new invoice
  async function generateInvoiceCodes(status: string) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    
    const yyyymmdd = `${yyyy}${mm}${dd}`;
    const yymmdd = `${String(yyyy).slice(-2)}${mm}${dd}`;
    
    // Daily sequence based on invoices created today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayInvoices = await db.select({ documentCode: invoices.documentCode })
      .from(invoices)
      .where(and(
        sql`${invoices.createdAt} >= ${startOfDay}`,
        sql`${invoices.createdAt} <= ${endOfDay}`
      ));
      
    let maxSeq = 0;
    for (const inv of todayInvoices) {
      if (inv.documentCode) {
        const parts = inv.documentCode.split('-');
        if (parts.length >= 3) {
          const numStr = parts[parts.length - 1];
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
      
    const sequenceNum = maxSeq + 1;
    let attempt = 0;
    let documentCode = '';
    let invoiceNumber = '';
    
    while(true) {
        const currentSeq = sequenceNum + attempt;
        const xxx = String(currentSeq).padStart(3, '0');
        
        if (status === 'CTT') {
          documentCode = `CTT-${yyyymmdd}-${xxx}`;
        } else if (status === 'TM') {
          documentCode = `TM-${yymmdd}-${xxx}`;
        } else {
          documentCode = `CK-${yymmdd}-${xxx}`;
        }
        
        invoiceNumber = `HD-${yyyymmdd}-${xxx}`;
        
        const existing = await db.select({id: invoices.id}).from(invoices).where(eq(invoices.documentCode, documentCode));
        if (existing.length === 0) {
            break;
        }
        attempt++;
    }
    
    return { documentCode, invoiceNumber };
  }

  // Regenerate document code for an existing invoice when its status changes
  async function getRegeneratedDocumentCode(invoiceId: number, newStatus: string) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error("Invoice not found");
    
    const date = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    const yyyymmdd = `${yyyy}${mm}${dd}`;
    const yymmdd = `${String(yyyy).slice(-2)}${mm}${dd}`;
    
    // Extract suffix or regenerate
    let sequenceNum = 1;
    const parts = invoice.documentCode.split('-');
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.length === 3 && !isNaN(Number(lastPart))) {
        sequenceNum = parseInt(lastPart, 10);
      }
    }
    
    let attempt = 0;
    let documentCode = '';
    while(true) {
        const currentSeq = sequenceNum + attempt;
        const xxx = String(currentSeq).padStart(3, '0');
        
        if (newStatus === 'CTT') {
          documentCode = `CTT-${yyyymmdd}-${xxx}`;
        } else if (newStatus === 'TM') {
          documentCode = `TM-${yymmdd}-${xxx}`;
        } else {
          documentCode = `CK-${yymmdd}-${xxx}`;
        }
        
        const existing = await db.select({id: invoices.id}).from(invoices).where(eq(invoices.documentCode, documentCode));
        if (existing.length === 0 || existing[0].id === invoiceId) {
            break;
        }
        attempt++;
    }
    
    return documentCode;
  }

  // Log changes for an invoice
  async function logInvoiceAction(invoiceId: number, action: string, details: string, email: string) {
    try {
      await db.insert(invoiceLogs).values({
        invoiceId,
        action,
        details,
        userEmail: email,
      });
    } catch (err) {
      console.error("Failed to write invoice log:", err);
    }
  }

  // Generate code and number for a new Purchase Order
  async function generatePOCodes(status: string) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    
    const yyyymmdd = `${yyyy}${mm}${dd}`;
    const yymmdd = `${String(yyyy).slice(-2)}${mm}${dd}`;
    
    // Daily sequence based on POs created today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayPOs = await db.select({ documentCode: purchaseOrders.documentCode })
      .from(purchaseOrders)
      .where(and(
        sql`${purchaseOrders.createdAt} >= ${startOfDay}`,
        sql`${purchaseOrders.createdAt} <= ${endOfDay}`
      ));
      
    let maxSeq = 0;
    for (const po of todayPOs) {
      if (po.documentCode) {
        const parts = po.documentCode.split('-');
        if (parts.length >= 3) {
          const numStr = parts[parts.length - 1];
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
      
    const sequenceNum = maxSeq + 1;
    let attempt = 0;
    let documentCode = '';
    let poNumber = '';
    
    while(true) {
        const currentSeq = sequenceNum + attempt;
        const xxx = String(currentSeq).padStart(3, '0');
        
        if (status === 'CTT') {
          documentCode = `PN-CTT-${yyyymmdd}-${xxx}`;
        } else if (status === 'TM') {
          documentCode = `PN-TM-${yymmdd}-${xxx}`;
        } else {
          documentCode = `PN-CK-${yymmdd}-${xxx}`;
        }
        
        poNumber = `PN-${yyyymmdd}-${xxx}`;
        
        const existing = await db.select({id: purchaseOrders.id}).from(purchaseOrders).where(eq(purchaseOrders.documentCode, documentCode));
        if (existing.length === 0) {
            break;
        }
        attempt++;
    }
    
    return { documentCode, poNumber };
  }

  // Regenerate document code for an existing PO when its status changes
  async function getRegeneratedPODocumentCode(poId: number, newStatus: string) {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
    if (!po) throw new Error("PO not found");
    
    const date = po.createdAt ? new Date(po.createdAt) : new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    const yyyymmdd = `${yyyy}${mm}${dd}`;
    const yymmdd = `${String(yyyy).slice(-2)}${mm}${dd}`;
    
    // Extract suffix or regenerate
    let sequenceNum = 1;
    const parts = po.documentCode.split('-');
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.length === 3 && !isNaN(Number(lastPart))) {
        sequenceNum = parseInt(lastPart, 10);
      }
    }
    
    let attempt = 0;
    let documentCode = '';
    while(true) {
        const currentSeq = sequenceNum + attempt;
        const xxx = String(currentSeq).padStart(3, '0');
        
        if (newStatus === 'CTT') {
          documentCode = `PN-CTT-${yyyymmdd}-${xxx}`;
        } else if (newStatus === 'TM') {
          documentCode = `PN-TM-${yymmdd}-${xxx}`;
        } else {
          documentCode = `PN-CK-${yymmdd}-${xxx}`;
        }
        
        const existing = await db.select({id: purchaseOrders.id}).from(purchaseOrders).where(eq(purchaseOrders.documentCode, documentCode));
        if (existing.length === 0 || existing[0].id === poId) {
            break;
        }
        attempt++;
    }
    
    return documentCode;
  }

  // Log changes for a PO
  async function logPOAction(poId: number, action: string, details: string, email: string) {
    try {
      await db.insert(purchaseOrderLogs).values({
        poId,
        action,
        details,
        userEmail: email,
      });
    } catch (err) {
      console.error("Failed to write PO log:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // API ENDPOINTS
  // ---------------------------------------------------------------------------

  // Test Endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Danger Zone - Wipe All Data Endpoint
  app.post("/api/danger/wipe-all-data", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { password } = req.body;
      if (password !== "atuan0987231270") {
        return res.status(403).json({ error: "Mật khẩu không chính xác" });
      }

      
      await db.transaction(async (tx) => {
        // Delete child records first
        await tx.delete(invoiceItems);
        await tx.delete(deposits);
        await tx.delete(invoiceLogs);
        await tx.delete(stockTransactions);
        await tx.delete(purchaseOrderItems);
        await tx.delete(purchaseOrderDeposits);
        await tx.delete(purchaseOrderLogs);
        await tx.delete(warehouseStocks);

        // Delete main records
        await tx.delete(invoices);
        await tx.delete(purchaseOrders);
        await tx.delete(products);
        await tx.delete(customers);
        await tx.delete(suppliers);
        await tx.delete(bankAccounts);
        await tx.delete(warehouses);
      });

      res.json({ success: true, message: "Đã xóa sạch toàn bộ dữ liệu hệ thống thành công!" });
    } catch (error: any) {
      console.error("Wipe all data failed:", error);
      res.status(500).json({ error: "Không thể xóa dữ liệu hệ thống" });
    }
  });

  app.get("/api/database/export", requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = {
        users: await db.select().from(users),
        warehouses: await db.select().from(warehouses),
        bankAccounts: await db.select().from(bankAccounts),
        suppliers: await db.select().from(suppliers),
        customers: await db.select().from(customers),
        products: await db.select().from(products),
        warehouseStocks: await db.select().from(warehouseStocks),
        purchaseOrders: await db.select().from(purchaseOrders),
        purchaseOrderItems: await db.select().from(purchaseOrderItems),
        purchaseOrderDeposits: await db.select().from(purchaseOrderDeposits),
        purchaseOrderLogs: await db.select().from(purchaseOrderLogs),
        invoices: await db.select().from(invoices),
        invoiceItems: await db.select().from(invoiceItems),
        deposits: await db.select().from(deposits),
        invoiceLogs: await db.select().from(invoiceLogs),
        stockTransactions: await db.select().from(stockTransactions),
      };
      res.json(data);
    } catch (err: any) {
      console.error("Database export failed:", err);
      res.status(500).json({ error: "Failed to export data: " + err.message });
    }
  });

  app.post("/api/database/import", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { password, data } = req.body;
      if (password !== "atuan0987231270") {
        return res.status(403).json({ error: "Mật khẩu không chính xác" });
      }
      
      // Convert date strings to Date objects
      function convertDates(obj: any) {
        if (obj === null || obj === undefined) return;
        if (typeof obj === "object") {
          for (let key in obj) {
            if (typeof obj[key] === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj[key])) {
              obj[key] = new Date(obj[key]);
            } else if (typeof obj[key] === "object") {
              convertDates(obj[key]);
            }
          }
        }
      }
      convertDates(data);

      await db.transaction(async (tx) => {
        // Delete child records first
        await tx.delete(invoiceItems);
        await tx.delete(deposits);
        await tx.delete(invoiceLogs);
        await tx.delete(stockTransactions);
        await tx.delete(purchaseOrderItems);
        await tx.delete(purchaseOrderDeposits);
        await tx.delete(purchaseOrderLogs);
        await tx.delete(warehouseStocks);
        
        // Delete main records
        await tx.delete(invoices);
        await tx.delete(purchaseOrders);
        await tx.delete(products);
        await tx.delete(customers);
        await tx.delete(suppliers);
        await tx.delete(bankAccounts);
        await tx.delete(warehouses);
        await tx.delete(users);

        // Insert records (order is important for foreign keys)
        if (data.users?.length) await tx.insert(users).values(data.users);
        if (data.warehouses?.length) await tx.insert(warehouses).values(data.warehouses);
        if (data.bankAccounts?.length) await tx.insert(bankAccounts).values(data.bankAccounts);
        if (data.suppliers?.length) await tx.insert(suppliers).values(data.suppliers);
        if (data.customers?.length) await tx.insert(customers).values(data.customers);
        if (data.products?.length) await tx.insert(products).values(data.products);
        if (data.warehouseStocks?.length) await tx.insert(warehouseStocks).values(data.warehouseStocks);
        if (data.purchaseOrders?.length) await tx.insert(purchaseOrders).values(data.purchaseOrders);
        if (data.purchaseOrderItems?.length) await tx.insert(purchaseOrderItems).values(data.purchaseOrderItems);
        if (data.purchaseOrderDeposits?.length) await tx.insert(purchaseOrderDeposits).values(data.purchaseOrderDeposits);
        if (data.purchaseOrderLogs?.length) await tx.insert(purchaseOrderLogs).values(data.purchaseOrderLogs);
        if (data.invoices?.length) await tx.insert(invoices).values(data.invoices);
        if (data.invoiceItems?.length) await tx.insert(invoiceItems).values(data.invoiceItems);
        if (data.deposits?.length) await tx.insert(deposits).values(data.deposits);
        if (data.invoiceLogs?.length) await tx.insert(invoiceLogs).values(data.invoiceLogs);
        if (data.stockTransactions?.length) await tx.insert(stockTransactions).values(data.stockTransactions);
        
        // Postgres sequences need to be reset since we insert explicit IDs
        await tx.execute(sql`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id)+1 FROM users), 1), false)`);
        await tx.execute(sql`SELECT setval('warehouses_id_seq', COALESCE((SELECT MAX(id)+1 FROM warehouses), 1), false)`);
        await tx.execute(sql`SELECT setval('bank_accounts_id_seq', COALESCE((SELECT MAX(id)+1 FROM bank_accounts), 1), false)`);
        await tx.execute(sql`SELECT setval('suppliers_id_seq', COALESCE((SELECT MAX(id)+1 FROM suppliers), 1), false)`);
        await tx.execute(sql`SELECT setval('customers_id_seq', COALESCE((SELECT MAX(id)+1 FROM customers), 1), false)`);
        await tx.execute(sql`SELECT setval('products_id_seq', COALESCE((SELECT MAX(id)+1 FROM products), 1), false)`);
        await tx.execute(sql`SELECT setval('warehouse_stocks_id_seq', COALESCE((SELECT MAX(id)+1 FROM warehouse_stocks), 1), false)`);
        await tx.execute(sql`SELECT setval('purchase_orders_id_seq', COALESCE((SELECT MAX(id)+1 FROM purchase_orders), 1), false)`);
        await tx.execute(sql`SELECT setval('purchase_order_items_id_seq', COALESCE((SELECT MAX(id)+1 FROM purchase_order_items), 1), false)`);
        await tx.execute(sql`SELECT setval('purchase_order_deposits_id_seq', COALESCE((SELECT MAX(id)+1 FROM purchase_order_deposits), 1), false)`);
        await tx.execute(sql`SELECT setval('purchase_order_logs_id_seq', COALESCE((SELECT MAX(id)+1 FROM purchase_order_logs), 1), false)`);
        await tx.execute(sql`SELECT setval('invoices_id_seq', COALESCE((SELECT MAX(id)+1 FROM invoices), 1), false)`);
        await tx.execute(sql`SELECT setval('invoice_items_id_seq', COALESCE((SELECT MAX(id)+1 FROM invoice_items), 1), false)`);
        await tx.execute(sql`SELECT setval('deposits_id_seq', COALESCE((SELECT MAX(id)+1 FROM deposits), 1), false)`);
        await tx.execute(sql`SELECT setval('invoice_logs_id_seq', COALESCE((SELECT MAX(id)+1 FROM invoice_logs), 1), false)`);
        await tx.execute(sql`SELECT setval('stock_transactions_id_seq', COALESCE((SELECT MAX(id)+1 FROM stock_transactions), 1), false)`);
      });
      
      res.json({ success: true, message: "Nhập dữ liệu thành công" });
    } catch (err: any) {
      console.error("Database import failed:", err);
      res.status(500).json({ error: "Failed to import data: " + err.message });
    }
  });

  // --- WAREHOUSES ---
  app.get("/api/warehouses", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allWarehouses = await db.select().from(warehouses).orderBy(asc(warehouses.name));
      res.json(allWarehouses);
    } catch (error) {
      res.status(500).json({ error: "Failed to load warehouses" });
    }
  });

  app.post("/api/warehouses", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { code, name, address, note } = req.body;
      if (!name || !code) return res.status(400).json({ error: "Code and Name are required" });
      const [newWarehouse] = await db.insert(warehouses).values({ code, name, address, note }).returning();
      res.status(201).json(newWarehouse);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Mã kho đã tồn tại" });
      }
      res.status(500).json({ error: "Failed to create warehouse" });
    }
  });

  app.put("/api/warehouses/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { code, name, address, note } = req.body;
      if (!name || !code) return res.status(400).json({ error: "Code and Name are required" });
      const [updated] = await db.update(warehouses).set({ code, name, address, note }).where(eq(warehouses.id, Number(req.params.id))).returning();
      res.json(updated);
    } catch (error: any) {
       if (error.code === '23505') {
        return res.status(400).json({ error: "Mã kho đã tồn tại" });
      }
      res.status(500).json({ error: "Failed to update warehouse" });
    }
  });

  app.delete("/api/warehouses/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      await db.delete(warehouses).where(eq(warehouses.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete warehouse" });
    }
  });

  // --- PRODUCTS ---
  app.get("/api/products", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { search, lowStock, inStock, warehouseId } = req.query;
      let conditions = [];
      conditions.push(eq(products.isHidden, false));
      if (warehouseId) conditions.push(eq(products.warehouseId, Number(warehouseId)));
      if (search) {
        const words = (search as string).split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          if (getIsUnaccentSupported()) {
            const wordConditions = words.map(word => {
              const pattern = `%${word}%`;
              return or(
                sql`unaccent(${products.name}) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(${products.code}) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(${products.category}) ILIKE unaccent(${pattern}::text)`
              );
            });
            conditions.push(and(...wordConditions));
          } else {
            const wordConditions = words.map(word => {
              const pattern = `%${word}%`;
              return or(
                sql`${products.name} ILIKE ${pattern}::text`,
                sql`${products.code} ILIKE ${pattern}::text`,
                sql`${products.category} ILIKE ${pattern}::text`
              );
            });
            conditions.push(and(...wordConditions));
          }
        }
      }
      if (lowStock === "true") conditions.push(sql`${products.quantity} <= ${products.minStock}`);
      if (inStock === "true") conditions.push(sql`${products.quantity} > 0`);
      const query = db.select({
        id: products.id,
        code: products.code,
        name: products.name,
        category: products.category,
        unit: products.unit,
        quantity: products.quantity,
        price: products.price,
        minStock: products.minStock,
        isHidden: products.isHidden,
        warehouseId: products.warehouseId,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name
      }).from(products)
      .leftJoin(warehouses, eq(products.warehouseId, warehouses.id));
      if (conditions.length > 0) query.where(and(...conditions));
      const result = await query.orderBy(desc(products.id));
      res.json(result);
    } catch (error: any) {
      console.error("GET /api/products failed:", error);
      res.status(500).json({ error: "Failed to load products" });
    }
  });

  app.post("/api/products", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { code, name, category, unit, quantity, price, minStock, warehouseId } = req.body;
      if (!code || !name || !warehouseId) return res.status(400).json({ error: "Code, Name and Warehouse are required" });
      const [existing] = await db.select().from(products).where(and(eq(products.code, code), eq(products.warehouseId, Number(warehouseId))));
      if (existing) return res.status(400).json({ error: "Product code already exists" });
      const [newProd] = await db.insert(products)
        .values({
          code,
          name,
          category: category || "Chưa phân loại",
          unit: unit || "",
          quantity: Number(quantity) || 0,
          price: Number(price) || 0,
          minStock: Number(minStock) || 10,
          warehouseId: Number(warehouseId)
        })
        .returning();
      if (newProd.quantity > 0) {
        await db.insert(stockTransactions).values({
          productId: newProd.id,
          type: "NHAP",
          quantity: newProd.quantity,
          note: "Nhập tồn kho khởi tạo khi thêm mới sản phẩm",
          userEmail: req.user?.email || "system",
          warehouseId: Number(warehouseId)
        });
      }
      res.status(201).json(newProd);
    } catch (error: any) {
      console.error("POST /api/products failed:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { code, name, category, unit, price, quantity, minStock } = req.body;
      if (!code || !name) return res.status(400).json({ error: "Code and Name are required" });
      const updateData: any = {
        code, name, category,
        unit: unit || "",
        price: Number(price) || 0,
        minStock: Number(minStock) || 0,
        updatedAt: new Date(),
      };
      if (quantity !== undefined) updateData.quantity = Number(quantity);
      const [updated] = await db.update(products).set(updateData).where(eq(products.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Product not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("PUT /api/products failed:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.patch("/api/products/:id/hide", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const [updated] = await db.update(products).set({ isHidden: true, updatedAt: new Date() }).where(eq(products.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Product not found" });
      res.json({ message: "Product hidden successfully" });
    } catch (error: any) {
      console.error("PATCH /api/products/:id/hide failed:", error);
      res.status(500).json({ error: "Failed to hide product" });
    }
  });

  app.post("/api/products/stock-transaction", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { productId, type, quantity, note, warehouseId } = req.body;
      const qty = Number(quantity);
      if (!productId || !type || isNaN(qty) || qty <= 0 || !warehouseId) return res.status(400).json({ error: "Invalid request" });
      const [product] = await db.select().from(products).where(and(eq(products.id, Number(productId)), eq(products.warehouseId, Number(warehouseId))));
      if (!product) return res.status(404).json({ error: "Product not found in this warehouse" });
      let newQty = product.quantity;
      if (type === "NHAP") {
        newQty += qty;
      } else if (type === "XUAT") {
        if (product.quantity < qty) return res.status(400).json({ error: `Not enough stock (current: ${product.quantity})` });
        newQty -= qty;
      } else {
        return res.status(400).json({ error: "Invalid type" });
      }
      await db.update(products).set({ quantity: newQty, updatedAt: new Date() }).where(eq(products.id, product.id));
      const [tx] = await db.insert(stockTransactions).values({
        productId: product.id,
        type,
        quantity: qty,
        note: note || (type === "NHAP" ? "Nhập kho thủ công" : "Xuất kho thủ công"),
        userEmail: req.user?.email || "system",
        warehouseId: Number(warehouseId)
      }).returning();
      res.json({ product: { ...product, quantity: newQty }, transaction: tx });
    } catch (error: any) {
      console.error("POST /api/products/stock-transaction failed:", error);
      res.status(500).json({ error: "Failed to perform stock action" });
    }
  });

  app.get("/api/products/:id/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const [product] = await db.select().from(products).where(eq(products.id, id));
      if (!product) return res.status(404).json({ error: "Product not found" });
      const txList = await db.select().from(stockTransactions).where(eq(stockTransactions.productId, id)).orderBy(asc(stockTransactions.createdAt), asc(stockTransactions.id));
      let runningBalance = 0;
      const enrichedList = txList.map(tx => {
        if (tx.type === "NHAP" || tx.type === "BO_GHI_SO") {
          runningBalance += tx.quantity;
        } else if (tx.type === "XUAT" || tx.type === "GHI_SO") {
          runningBalance -= tx.quantity;
        }
        return { ...tx, runningBalance };
      });
      res.json(enrichedList.reverse());
    } catch (error: any) {
      console.error("GET transactions failed:", error);
      res.status(500).json({ error: "Failed to load history" });
    }
  });

  app.post("/api/products/import", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { items, warehouseId } = req.body;
      if (!Array.isArray(items) || items.length === 0 || !warehouseId) return res.status(400).json({ error: "Invalid items or missing warehouseId" });
      let importedCount = 0;
      let skippedCount = 0;
      let updatedCount = 0;
      for (const item of items) {
        const { code, name, category, unit, quantity, price, minStock } = item;
        if (!code || !name) { skippedCount++; continue; }
        const trimmedCode = String(code).trim();
        if (!trimmedCode) { skippedCount++; continue; }
        const [existing] = await db.select().from(products).where(and(eq(products.code, trimmedCode), eq(products.warehouseId, Number(warehouseId))));
        const qty = Number(quantity) || 0;
        const prc = Math.round(Number(price)) || 0;
        const mst = Math.round(Number(minStock)) || 10;
        
        if (existing) {
          const nm = String(name).trim() || existing.name;
          const cat = category ? String(category).trim() : existing.category;
          const unt = unit ? String(unit).trim() : existing.unit;
          
          await db.update(products).set({
            name: nm,
            category: cat,
            unit: unt,
            quantity: qty !== undefined && quantity !== "" ? qty : existing.quantity,
            price: price !== undefined && price !== "" ? prc : existing.price,
            minStock: minStock !== undefined && minStock !== "" ? mst : existing.minStock,
            updatedAt: new Date()
          }).where(eq(products.id, existing.id));
          
          if (qty !== undefined && quantity !== "" && qty !== existing.quantity) {
             const diff = qty - existing.quantity;
             await db.insert(stockTransactions).values({
               productId: existing.id,
               type: diff > 0 ? "NHAP" : "XUAT",
               quantity: Math.abs(diff),
               note: "Cập nhật tồn kho từ import Excel",
               userEmail: req.user?.email || "system",
               warehouseId: Number(warehouseId)
             });
          }
          
          updatedCount++;
          continue; 
        }

        const [newProd] = await db.insert(products)
          .values({
            code: trimmedCode,
            name: String(name).trim(),
            category: category ? String(category).trim() : "Chưa phân loại",
            unit: unit ? String(unit).trim() : "",
            quantity: qty,
            price: prc,
            minStock: mst,
            warehouseId: Number(warehouseId)
          })
          .returning();
        if (qty > 0) {
          await db.insert(stockTransactions).values({
            productId: newProd.id,
            type: "NHAP",
            quantity: qty,
            note: "Nhập tồn kho khởi tạo từ import Excel",
            userEmail: req.user?.email || "system",
            warehouseId: Number(warehouseId)
          });
        }
        importedCount++;
      }
      res.json({ message: "Import completed", importedCount, skippedCount, updatedCount });
    } catch (error: any) {
      console.error("POST /api/products/import failed:", error);
      res.status(500).json({ error: "Failed to import products" });
    }
  });

  // --- SUPPLIERS ---
  app.get("/api/suppliers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { search } = req.query;
      const query = db.select().from(suppliers);
      if (search) {
        const words = (search as string).split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          if (getIsUnaccentSupported()) {
            const wordConditions = words.map(word => {
              const pattern = `%${word}%`;
              return or(
                sql`unaccent(${suppliers.name}) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(${suppliers.phone}) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(${suppliers.address}) ILIKE unaccent(${pattern}::text)`
              );
            });
            query.where(and(...wordConditions));
          } else {
            const wordConditions = words.map(word => {
              const pattern = `%${word}%`;
              return or(
                sql`${suppliers.name} ILIKE ${pattern}::text`,
                sql`${suppliers.phone} ILIKE ${pattern}::text`,
                sql`${suppliers.address} ILIKE ${pattern}::text`
              );
            });
            query.where(and(...wordConditions));
          }
        }
      }
      const list = await query.orderBy(desc(suppliers.id));
      res.json(list);
    } catch (error: any) {
      console.error("GET /api/suppliers failed:", error);
      res.status(500).json({ error: "Failed to load suppliers" });
    }
  });

  app.post("/api/suppliers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, phone, address, taxId } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Supplier name is required" });
      }

      const [newSupp] = await db.insert(suppliers)
        .values({
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          address: address ? address.trim() : null,
          taxId: taxId ? taxId.trim() : null,
        })
        .returning();

      res.status(201).json(newSupp);
    } catch (error: any) {
      console.error("POST /api/suppliers failed:", error);
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.put("/api/suppliers/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, phone, address, taxId } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Supplier name is required" });
      }

      const [updated] = await db.update(suppliers)
        .set({
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          address: address ? address.trim() : null,
          taxId: taxId ? taxId.trim() : null,
        })
        .where(eq(suppliers.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Supplier not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("PUT /api/suppliers/:id failed:", error);
      res.status(500).json({ error: "Failed to update supplier" });
    }
  });

  app.get("/api/suppliers/:id/history", requireAuth, async (req: AuthRequest, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      
      const orders = await db.select()
        .from(purchaseOrders)
        .where(and(
          eq(purchaseOrders.supplierId, supplierId),
          eq(purchaseOrders.isRecorded, true)
        ))
        .orderBy(desc(purchaseOrders.createdAt));
        
      res.json(orders);
    } catch (error: any) {
      console.error("GET /api/suppliers/:id/history failed:", error);
      res.status(500).json({ error: "Failed to load supplier history" });
    }
  });

  // --- CUSTOMERS ---
  app.get("/api/customers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { search } = req.query;
      const query = db.select().from(customers);
      if (search) {
        const words = (search as string).split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          if (getIsUnaccentSupported()) {
            const wordConditions = words.map(word => {
              const pattern = `%${word}%`;
              return or(
                sql`unaccent(${customers.name}) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(${customers.phone}) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(${customers.address}) ILIKE unaccent(${pattern}::text)`
              );
            });
            query.where(and(...wordConditions));
          } else {
            const wordConditions = words.map(word => {
              const pattern = `%${word}%`;
              return or(
                sql`${customers.name} ILIKE ${pattern}::text`,
                sql`${customers.phone} ILIKE ${pattern}::text`,
                sql`${customers.address} ILIKE ${pattern}::text`
              );
            });
            query.where(and(...wordConditions));
          }
        }
      }
      const list = await query.orderBy(desc(customers.id));
      res.json(list);
    } catch (error: any) {
      console.error("GET /api/customers failed:", error);
      res.status(500).json({ error: "Failed to load customers" });
    }
  });

  app.post("/api/customers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, phone, address, taxId } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Customer name is required" });
      }

      const [newCust] = await db.insert(customers)
        .values({
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          address: address ? address.trim() : null,
          taxId: taxId ? taxId.trim() : null,
        })
        .returning();

      res.status(201).json(newCust);
    } catch (error: any) {
      console.error("POST /api/customers failed:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, phone, address, taxId } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Customer name is required" });
      }

      const [updated] = await db.update(customers)
        .set({
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          address: address ? address.trim() : null,
          taxId: taxId ? taxId.trim() : null,
        })
        .where(eq(customers.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("PUT /api/customers/:id failed:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.get("/api/customers/:id/history", requireAuth, async (req: AuthRequest, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const list = await db.select()
        .from(invoices)
        .where(eq(invoices.customerId, customerId))
        .orderBy(desc(invoices.createdAt));
      res.json(list);
    } catch (error: any) {
      console.error("GET customer history failed:", error);
      res.status(500).json({ error: "Failed to load customer order history" });
    }
  });

  // Batch Import Customers
  app.post("/api/customers/import", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Invalid items array" });
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const item of items) {
        const { name, phone, address, taxId } = item;
        if (!name) {
          skippedCount++;
          continue;
        }

        const [existing] = await db.select().from(customers).where(eq(customers.name, String(name).trim()));
        if (existing) {
          skippedCount++;
          continue;
        }

        await db.insert(customers).values({
          name: String(name).trim(),
          phone: phone ? String(phone).trim() : null,
          address: address ? String(address).trim() : null,
          taxId: taxId ? String(taxId).trim() : null,
        });

        importedCount++;
      }

      res.json({ message: "Import completed", importedCount, skippedCount });
    } catch (error: any) {
      console.error("POST /api/customers/import failed:", error);
      res.status(500).json({ error: "Failed to import customers" });
    }
  });

  // Batch Import Suppliers
  app.post("/api/suppliers/import", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Invalid items array" });
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const item of items) {
        const { name, phone, address, taxId } = item;
        if (!name) {
          skippedCount++;
          continue;
        }

        const [existing] = await db.select().from(suppliers).where(eq(suppliers.name, String(name).trim()));
        if (existing) {
          skippedCount++;
          continue;
        }

        await db.insert(suppliers).values({
          name: String(name).trim(),
          phone: phone ? String(phone).trim() : null,
          address: address ? String(address).trim() : null,
          taxId: taxId ? String(taxId).trim() : null,
        });

        importedCount++;
      }

      res.json({ message: "Import completed", importedCount, skippedCount });
    } catch (error: any) {
      console.error("POST /api/suppliers/import failed:", error);
      res.status(500).json({ error: "Failed to import suppliers" });
    }
  });


  // --- INVOICES & SALES ---

  // List posted / statistics invoices (with pagination of 30)
  app.get("/api/invoices", requireAuth, async (req: AuthRequest, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      const { search, status, isRecorded, startDate, endDate, sort } = req.query;

      let conditions = [];

      if (isRecorded !== undefined) {
        conditions.push(eq(invoices.isRecorded, isRecorded === 'true'));
      }

      if (status) {
        if (status === 'CK') {
          conditions.push(
            or(
              eq(invoices.status, 'CK'),
              like(invoices.status, 'CK - %')
            )
          );
        } else {
          conditions.push(eq(invoices.status, status as string));
        }
      }

      if (startDate) {
        conditions.push(gte(invoices.createdAt, new Date(startDate as string)));
      }

      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(invoices.createdAt, end));
      }

      if (search) {
        const words = (search as string).split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          if (getIsUnaccentSupported()) {
            const wordConditions = words.map(word => {
              const pattern = `%${word}%`;
              return or(
                sql`unaccent(COALESCE(${invoices.invoiceNumber}, '')) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(COALESCE(${invoices.documentCode}, '')) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(COALESCE(${invoices.customCustomerName}, '')) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(COALESCE(${customers.name}, '')) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(COALESCE(${customers.phone}, '')) ILIKE unaccent(${pattern}::text)`,
                sql`unaccent(COALESCE(${customers.taxId}, '')) ILIKE unaccent(${pattern}::text)`
              );
            });
            conditions.push(and(...wordConditions));
          } else {
            const VI_ACCENTS = 'áàảãạâấầẩẫậăắằẳẵặđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶĐÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ';
            const VI_NON_ACCENTS = 'aaaaaaaaaaaaaaaaadeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyAAAAAAAAAAAAAAAAADEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYY';
            const wordConditions = words.map(word => {
              const pattern = `%${word}%`;
              // Also remove accents from the search pattern in case the user types with accents but the DB text has different accent normalization
              const cleanPattern = sql`translate(${pattern}::text, ${VI_ACCENTS}, ${VI_NON_ACCENTS})`;
              return or(
                sql`translate(COALESCE(${invoices.invoiceNumber}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
                sql`translate(COALESCE(${invoices.documentCode}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
                sql`translate(COALESCE(${invoices.customCustomerName}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
                sql`translate(COALESCE(${customers.name}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
                sql`translate(COALESCE(${customers.phone}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
                sql`translate(COALESCE(${customers.taxId}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`
              );
            });
            conditions.push(and(...wordConditions));
          }
        }
      }

      const filterClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Count total matching invoices
      const [countResult] = await db.select({ 
        count: sql<number>`count(*)::int`,
        sumAmount: sql<any>`sum(${invoices.totalAmount} - CASE WHEN ${invoices.depositEnabled} = TRUE THEN COALESCE((SELECT sum(amount) FROM deposits WHERE invoice_id = ${invoices.id}), 0) ELSE 0 END)::numeric`
      })
        .from(invoices)
        .leftJoin(customers, eq(invoices.customerId, customers.id))
        .where(filterClause);
      const total = countResult ? Number(countResult.count) : 0;
      const totalAmountSum = countResult && countResult.sumAmount ? Number(countResult.sumAmount) : 0;

      // Fetch invoice list
      const list = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        documentCode: invoices.documentCode,
        status: invoices.status,
        isRecorded: invoices.isRecorded,
        depositEnabled: invoices.depositEnabled,
        totalAmount: invoices.totalAmount,
        totalDeposits: sql<number>`COALESCE((SELECT sum(amount) FROM deposits WHERE invoice_id = ${invoices.id}), 0)::int`,
        createdAt: invoices.createdAt,
        customerId: invoices.customerId,
        customerName: sql<string>`COALESCE(${invoices.customCustomerName}, ${customers.name})`,
        customerPhone: customers.phone,
        customerTaxId: customers.taxId,
        createdByEmail: users.email,
        customCustomerName: invoices.customCustomerName,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(users, eq(invoices.createdBy, users.id))
      .where(filterClause)
      .orderBy(sort === 'asc' ? asc(invoices.createdAt) : desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);

      res.json({
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalAmountSum,
        invoices: list,
      });
    } catch (error: any) {
      console.error("GET /api/invoices failed:", error);
      res.status(500).json({ error: "Failed to load invoices" });
    }
  });

  // Get single invoice with full details (items, deposits, logs)
  app.get("/api/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [invoice] = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        documentCode: invoices.documentCode,
        customerId: invoices.customerId,
        status: invoices.status,
        bankAccountId: invoices.bankAccountId,
        isRecorded: invoices.isRecorded,
        depositEnabled: invoices.depositEnabled,
        totalAmount: invoices.totalAmount,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        customerName: sql<string>`COALESCE(${invoices.customCustomerName}, ${customers.name})`,
        customerPhone: customers.phone,
        customerAddress: customers.address,
        customerTaxId: customers.taxId,
        createdByEmail: users.email,
        customCustomerName: invoices.customCustomerName,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(users, eq(invoices.createdBy, users.id))
      .where(eq(invoices.id, id));

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Fetch Items
      const items = await db.select({
        id: invoiceItems.id,
        invoiceId: invoiceItems.invoiceId,
        productId: invoiceItems.productId,
        productName: invoiceItems.productName,
        productCode: invoiceItems.productCode,
        unit: invoiceItems.unit,
        quantity: invoiceItems.quantity,
        price: invoiceItems.price,
        totalPrice: invoiceItems.totalPrice,
        hasVat: invoiceItems.hasVat,
        vatRate: invoiceItems.vatRate,
        warehouseId: invoiceItems.warehouseId
      })
      .from(invoiceItems)
      .leftJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(invoiceItems.invoiceId, id));

      // Fetch Deposits
      const invoiceDeposits = await db.select().from(deposits).where(eq(deposits.invoiceId, id));

      // Fetch Logs
      const logs = await db.select().from(invoiceLogs).where(eq(invoiceLogs.invoiceId, id)).orderBy(desc(invoiceLogs.id));

      res.json({
        ...invoice,
        items,
        deposits: invoiceDeposits,
        logs,
      });
    } catch (error: any) {
      console.error("GET invoice detail failed:", error);
      res.status(500).json({ error: "Failed to load invoice details" });
    }
  });

  // Create Invoice (Draft - goes directly into "Trang chờ" as isRecorded: false)
  app.post("/api/invoices", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerId, status, depositEnabled, items, invoiceNumberCustom, customCustomerName } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Invoice must have at least one product" });
      }

      const activeStatus = status || "CTT"; // default Chưa thanh toán
      const { documentCode, invoiceNumber } = await generateInvoiceCodes(activeStatus);

      // Total invoice amount
      let totalAmount = 0;
      const processedItems = items.map((itm: any) => {
        const qty = Number(itm.quantity) || 1;
        const price = Number(itm.price) || 0;
        const totalItem = qty * price;
        totalAmount += totalItem;

        return {
          productId: itm.productId ? Number(itm.productId) : null,
          productName: String(itm.productName),
          productCode: String(itm.productCode),
          unit: itm.unit ? String(itm.unit) : "",
          quantity: qty,
          price: price,
          totalPrice: totalItem,
          hasVat: Boolean(itm.hasVat),
          vatRate: itm.vatRate ? Number(itm.vatRate) : 0,
          warehouseId: itm.warehouseId ? Number(itm.warehouseId) : null,
        };
      });

      // Insert invoice
      const [newInvoice] = await db.insert(invoices)
        .values({
          invoiceNumber: invoiceNumberCustom ? String(invoiceNumberCustom).trim() : "0",
          documentCode,
          customerId: customerId ? Number(customerId) : null,
          customCustomerName: customCustomerName || null,
          status: activeStatus,
          isRecorded: false, // Start as draft (Trang chờ)
          depositEnabled: !!depositEnabled,
          totalAmount: totalAmount,
          createdBy: req.user?.dbId,
        })
        .returning();

      // Insert items
      for (const pItem of processedItems) {
        await db.insert(invoiceItems).values({
          invoiceId: newInvoice.id,
          ...pItem,
        });
      }

      // Log invoice action
      await logInvoiceAction(
        newInvoice.id,
        "TẠO MỚI",
        `Đã tạo hóa đơn tạm (Chưa ghi sổ). Mã chứng từ: ${documentCode}, Số hóa đơn: ${newInvoice.invoiceNumber}, Tổng tiền: ${totalAmount.toLocaleString('vi-VN')} VND.`,
        req.user?.email || "system"
      );

      res.status(201).json(newInvoice);
    } catch (error: any) {
      console.error("POST /api/invoices failed:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.post("/api/invoices/create-blank", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { documentCode, invoiceNumber } = await generateInvoiceCodes('CTT');
      const [newInvoice] = await db.insert(invoices).values({
        invoiceNumber: "0",
        documentCode,
        status: 'CTT',
        isRecorded: false,
        totalAmount: 0,
        createdBy: req.user?.dbId,
      }).returning();
      
      await logInvoiceAction(newInvoice.id, 'TẠO MỚI', 'Tạo hóa đơn mới (trống)', req.user?.email || 'Unknown');
      res.json(newInvoice);
    } catch (error) {
      console.error("POST /api/invoices/create-blank failed:", error);
      res.status(500).json({ error: "Failed to create blank invoice" });
    }
  });

  // Edit / Update Invoice details
  app.put("/api/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
    let retries = 3;
    while (retries > 0) {
      try {
        const id = parseInt(req.params.id);
        const { customerId, status, depositEnabled, items, invoiceNumber, documentCode, createdAt, deposits: bodyDeposits, customCustomerName, bankAccountId } = req.body;

        const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
        if (!existing) {
          return res.status(404).json({ error: "Invoice not found" });
        }

        // If it is already recorded, check if items were changed. If items changed, block unless unposted
        if (existing.isRecorded && items && Array.isArray(items)) {
          return res.status(400).json({ error: "Hóa đơn đã ghi sổ. Vui lòng BỎ GHI SỔ trước khi chỉnh sửa danh sách sản phẩm." });
        }

        const newCreatedAt = createdAt ? new Date(createdAt) : (existing.createdAt ? new Date(existing.createdAt) : new Date());

        let docCode = existing.documentCode;
        let updateStatus = existing.status;
        if (status && status !== existing.status) {
          updateStatus = status;
          docCode = await getRegeneratedDocumentCode(id, status);
        } else if (documentCode) {
          docCode = documentCode; // support custom update
        }

        docCode = updateCodeWithNewDate(docCode, newCreatedAt);
        const originalInvoiceNumber = invoiceNumber !== undefined ? (String(invoiceNumber).trim() || "0") : existing.invoiceNumber;
        const finalInvoiceNumber = updateCodeWithNewDate(originalInvoiceNumber, newCreatedAt);

        let totalAmount = existing.totalAmount;

        // Update basic fields
        await db.update(invoices)
          .set({
            invoiceNumber: finalInvoiceNumber,
            documentCode: docCode,
            customerId: customerId ? Number(customerId) : existing.customerId,
            customCustomerName: customCustomerName !== undefined ? customCustomerName : existing.customCustomerName,
            status: updateStatus,
            bankAccountId: bankAccountId !== undefined ? (bankAccountId ? Number(bankAccountId) : null) : existing.bankAccountId,
            depositEnabled: depositEnabled !== undefined ? !!depositEnabled : existing.depositEnabled,
            createdAt: newCreatedAt,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, id));

        // Update corresponding stock transactions if any exist
        await db.update(stockTransactions)
          .set({
            createdAt: newCreatedAt,
            docNumber: docCode
          })
          .where(eq(stockTransactions.docNumber, existing.documentCode));

        // If deposits are sent, recreate them
        if (bodyDeposits && Array.isArray(bodyDeposits)) {
          await db.delete(deposits).where(eq(deposits.invoiceId, id));
          for (const dep of bodyDeposits) {
            await db.insert(deposits).values({
              invoiceId: id,
              amount: Math.max(0, Number(dep.amount)),
              paymentMethod: dep.paymentMethod || 'CK',
              note: dep.note ? String(dep.note).trim() : null,
              createdAt: dep.createdAt ? new Date(dep.createdAt) : new Date(),
            });
          }
        }

        // If we are in draft mode and items are sent, recreate them
        if (!existing.isRecorded && items && Array.isArray(items)) {
          // Delete existing items
          await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
          
          // Insert new items & calculate total
          totalAmount = 0;
          for (const itm of items) {
            const qty = Number(itm.quantity) || 1;
            const price = Number(itm.price) || 0;
            const itemTotal = qty * price;
            totalAmount += itemTotal;

            await db.insert(invoiceItems).values({
              invoiceId: id,
              productId: itm.productId ? Number(itm.productId) : null,
              productName: String(itm.productName),
              productCode: String(itm.productCode),
              unit: itm.unit ? String(itm.unit) : "",
              quantity: qty,
              price: price,
              totalPrice: itemTotal,
              hasVat: Boolean(itm.hasVat),
              vatRate: itm.vatRate ? Number(itm.vatRate) : 0,
              warehouseId: itm.warehouseId ? Number(itm.warehouseId) : null,
            });
          }

          // Update totalAmount
          await db.update(invoices)
            .set({ totalAmount: totalAmount })
            .where(eq(invoices.id, id));
        }

        await logInvoiceAction(
          id,
          "CHỈNH SỬA",
          `Đã cập nhật thông tin hóa đơn. Trạng thái mới: ${updateStatus}. Mã chứng từ mới: ${docCode}. Tổng tiền: ${totalAmount.toLocaleString('vi-VN')} VND.`,
          req.user?.email || "system"
        );

        res.json({ id, message: "Invoice updated successfully" });
        return;
      } catch (error: any) {
        retries--;
        const msg = error.message || String(error) || '';
        const causeMsg = error.cause?.message || String(error.cause) || '';
        if (retries > 0 && (msg.includes('Connection terminated unexpectedly') || causeMsg.includes('Connection terminated unexpectedly'))) {
           console.warn(`DB connection dropped in put invoice, retrying... (${3 - retries}/3)`);
           await new Promise(r => setTimeout(r, 1000));
           continue;
        }
        
        console.error("PUT /api/invoices failed:", error);
        res.status(500).json({ error: "Failed to update invoice: " + (error.message || String(error)) });
        return;
      }
    }
  });

  // GHI SỔ (Record Bill - subtract from inventory, move from Pending to Statistics)
  app.post("/api/invoices/:id/record", requireAuth, async (req: AuthRequest, res) => {
    let retries = 3;
    while (retries > 0) {
      try {
        const id = parseInt(req.params.id);

        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }

        if (invoice.isRecorded) {
          return res.status(400).json({ error: "Hóa đơn này đã ghi sổ rồi." });
        }

        // Load invoice items
        const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        
        // Verification: Ensure enough stock for all items
        for (const itm of items) {
          if (itm.productId) {
            const [prod] = await db.select().from(products).where(eq(products.id, itm.productId));
            if (!prod) {
              return res.status(400).json({ error: `Sản phẩm với mã ${itm.productCode} không tồn tại trong kho.` });
            }
            if (prod.quantity < itm.quantity) {
              return res.status(400).json({
                error: `Không đủ tồn kho tổng cho sản phẩm "${itm.productName}" (Mã: ${itm.productCode}). Hiện tại: ${prod.quantity}, Cần xuất: ${itm.quantity}.`
              });
            }
          }
        }

        // Perform transaction reductions and log stock transactions
        for (const itm of items) {
          if (itm.productId) {
            // Deduct total stock
            await db.update(products)
              .set({
                quantity: sql`${products.quantity} - ${itm.quantity}`,
                updatedAt: new Date(),
              })
              .where(eq(products.id, itm.productId));

            // Log stock reduction
            let partnerName = null;
            if (invoice.customerId) {
              const [cust] = await db.select().from(customers).where(eq(customers.id, invoice.customerId));
              if (cust) partnerName = cust.name;
            }
            await db.insert(stockTransactions).values({
              productId: itm.productId,
              type: "GHI_SO",
              quantity: itm.quantity,
              note: `Trừ kho tự động khi ghi sổ hóa đơn ${invoice.invoiceNumber} (${invoice.documentCode})`,
              userEmail: req.user?.email || "system",
              warehouseId: itm.warehouseId || null,
              docNumber: invoice.documentCode,
              partnerName: partnerName,
              unitPrice: itm.price,
              createdAt: invoice.createdAt ? new Date(invoice.createdAt) : new Date()
            });
          }
        }

        // Set as recorded
        await db.update(invoices)
          .set({
            isRecorded: true,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, id));

        await logInvoiceAction(
          id,
          "GHI SỔ",
          `Xác nhận ghi sổ hóa đơn. Đã trừ kho tương ứng các sản phẩm. Trạng thái: ${invoice.status}, Mã chứng từ: ${invoice.documentCode}.`,
          req.user?.email || "system"
        );

        res.json({ success: true, message: "Ghi sổ thành công. Đã cập nhật tồn kho vật tư." });
        return; // Success, exit retry loop
      } catch (error: any) {
        retries--;
        const msg = error.message || String(error) || '';
        const causeMsg = error.cause?.message || String(error.cause) || '';
        if (retries > 0 && (msg.includes('Connection terminated unexpectedly') || causeMsg.includes('Connection terminated unexpectedly'))) {
           console.warn(`DB connection dropped in record, retrying... (${3 - retries}/3)`);
           await new Promise(r => setTimeout(r, 1000));
           continue;
        }

        console.error("POST record invoice failed:", error);
        res.status(500).json({ error: "Failed to record invoice: " + (error.message || String(error)) });
        return;
      }
    }
  });

  // BỎ GHI SỔ (Unrecord Bill - add back to inventory, move from Statistics to Pending)
  app.post("/api/invoices/:id/unrecord", requireAuth, async (req: AuthRequest, res) => {
    let retries = 3;
    while (retries > 0) {
      try {
        const id = parseInt(req.params.id);

        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }

        if (!invoice.isRecorded) {
          return res.status(400).json({ error: "Hóa đơn này chưa được ghi sổ." });
        }

        // Load invoice items
        const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));

        // Add back to stock and log stock transactions
        for (const itm of items) {
          if (itm.productId) {
            // Re-add total stock
            await db.update(products)
              .set({
                quantity: sql`${products.quantity} + ${itm.quantity}`,
                updatedAt: new Date(),
              })
              .where(eq(products.id, itm.productId));

            // Log stock increment => INSTEAD, Delete the record
            await db.delete(stockTransactions)
              .where(
                and(
                  eq(stockTransactions.productId, itm.productId),
                  eq(stockTransactions.type, "GHI_SO"),
                  like(stockTransactions.note, `%${invoice.documentCode}%`)
                )
              );
          }
        }

        // Set as unrecorded
        await db.update(invoices)
          .set({
            isRecorded: false,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, id));

        await logInvoiceAction(
          id,
          "BỎ GHI SỔ",
          `Bỏ ghi sổ hóa đơn. Đã hoàn trả hàng hóa lại vào kho. Hóa đơn quay trở về trạng thái Chờ xác nhận.`,
          req.user?.email || "system"
        );

        res.json({ success: true, message: "Bỏ ghi sổ thành công. Đã hoàn kho các sản phẩm." });
        return; // Success, exit retry loop
      } catch (error: any) {
        retries--;
        const msg = error.message || String(error) || '';
        const causeMsg = error.cause?.message || String(error.cause) || '';
        if (retries > 0 && (msg.includes('Connection terminated unexpectedly') || causeMsg.includes('Connection terminated unexpectedly'))) {
           console.warn(`DB connection dropped in unrecord, retrying... (${3 - retries}/3)`);
           await new Promise(r => setTimeout(r, 1000));
           continue;
        }
        
        console.error("POST unrecord invoice failed:", error);
        res.status(500).json({ error: "Failed to unrecord invoice: " + (error.message || String(error)) });
        return;
      }
    }
  });

  // DUPLICATE INVOICE (Nhân bản hóa đơn)
  app.post("/api/invoices/:id/duplicate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);

      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Load items
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));

      // Generate new code & number for the clone
      const { documentCode, invoiceNumber } = await generateInvoiceCodes(invoice.status);

      // Create new draft invoice
      const [newInvoice] = await db.insert(invoices)
        .values({
          invoiceNumber: "0", // distinct name not needed anymore as unique constraint removed
          documentCode,
          customerId: invoice.customerId,
          status: invoice.status,
          isRecorded: false, // Starts as draft (Trang chờ)
          depositEnabled: invoice.depositEnabled,
          totalAmount: invoice.totalAmount,
          createdBy: req.user?.dbId,
        })
        .returning();

      // Insert cloned items
      for (const itm of items) {
        await db.insert(invoiceItems).values({
          invoiceId: newInvoice.id,
          productId: itm.productId,
          productName: itm.productName,
          productCode: itm.productCode,
          unit: itm.unit,
          quantity: itm.quantity,
          price: itm.price,
          totalPrice: itm.totalPrice,
          hasVat: Boolean(itm.hasVat),
          vatRate: itm.vatRate ? Number(itm.vatRate) : 0,
        });
      }

      await logInvoiceAction(
        newInvoice.id,
        "NHÂN BẢN",
        `Nhân bản từ hóa đơn cũ #${invoice.invoiceNumber} (${invoice.documentCode})`,
        req.user?.email || "system"
      );

      res.status(201).json(newInvoice);
    } catch (error: any) {
      console.error("POST duplicate invoice failed:", error);
      res.status(500).json({ error: "Failed to duplicate invoice" });
    }
  });

  // DELETE INVOICE
  app.delete("/api/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);

      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // If recorded, force unrecord or fail
      if (invoice.isRecorded) {
        return res.status(400).json({ error: "Hóa đơn đã ghi sổ. Vui lòng bỏ ghi sổ trước khi xóa." });
      }

      // Delete cascade is supported by foreign key setup in schema, but we double-verify
      await db.delete(invoices).where(eq(invoices.id, id));

      res.json({ message: "Invoice deleted successfully" });
    } catch (error: any) {
      console.error("DELETE invoice failed:", error);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // ADD DEPOSIT (Cọc nhiều lần)
  app.post("/api/invoices/:id/deposits", requireAuth, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const { amount, paymentMethod, note } = req.body;

      if (!amount || Number(amount) <= 0 || !paymentMethod) {
        return res.status(400).json({ error: "Vui lòng nhập đầy đủ số tiền cọc hợp lệ và phương thức." });
      }

      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const [newDep] = await db.insert(deposits)
        .values({
          invoiceId,
          amount: Number(amount),
          paymentMethod,
          note: note || "Khách hàng đặt cọc",
        })
        .returning();

      await logInvoiceAction(
        invoiceId,
        "ĐẶT CỌC",
        `Đã nhận tiền đặt cọc: ${Number(amount).toLocaleString('vi-VN')} VND qua ${paymentMethod === 'TM' ? 'Tiền mặt' : 'Chuyển khoản'}. Ghi chú: ${note || 'không có'}.`,
        req.user?.email || "system"
      );

      res.status(201).json(newDep);
    } catch (error: any) {
      console.error("POST invoice deposit failed:", error);
      res.status(500).json({ error: "Failed to add deposit" });
    }
  });

  // --- REPORT EXCEL EXPORT ---
  app.get("/api/reports/excel", requireAuth, async (req: AuthRequest, res) => {
    try {
      // 1. Fetch Products Data
      const dbProducts = await db.select().from(products).orderBy(asc(products.code));
      const productsSheetData = dbProducts.map(p => ({
        "Mã sản phẩm": p.code,
        "Tên sản phẩm": p.name,
        "Danh mục": p.category,
        "Số lượng tồn kho": p.quantity,
        "Đơn giá mặc định (VND)": p.price,
        "Ngưỡng tồn thấp": p.minStock,
        "Trạng thái": p.quantity <= p.minStock ? "Cảnh báo: Tồn kho thấp" : "Bình thường"
      }));

      // 2. Fetch Invoices Data
      const dbInvoices = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        documentCode: invoices.documentCode,
        status: invoices.status,
        isRecorded: invoices.isRecorded,
        totalAmount: invoices.totalAmount,
        createdAt: invoices.createdAt,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .orderBy(desc(invoices.createdAt));

      const invoicesSheetData = dbInvoices.map(inv => {
        let txtStatus = "Chưa thanh toán";
        if (inv.status === "TM") txtStatus = "Thanh toán tiền mặt";
        else if (inv.status === "CK") txtStatus = "Chuyển khoản";

        return {
          "Số hóa đơn": inv.invoiceNumber,
          "Mã chứng từ": inv.documentCode,
          "Khách hàng": inv.customerName || "Vãng lai",
          "Số điện thoại": inv.customerPhone || "",
          "Trạng thái thanh toán": txtStatus,
          "Tình trạng ghi sổ": inv.isRecorded ? "Đã ghi sổ (Trừ kho)" : "Chưa ghi sổ (Chờ)",
          "Tổng thành tiền (VND)": inv.totalAmount,
          "Ngày tạo": inv.createdAt ? new Date(inv.createdAt).toLocaleString('vi-VN') : ""
        };
      });

      // Create Workbook
      const wb = xlsx.utils.book_new();

      const wsProducts = xlsx.utils.json_to_sheet(productsSheetData);
      const wsInvoices = xlsx.utils.json_to_sheet(invoicesSheetData);

      xlsx.utils.book_append_sheet(wb, wsProducts, "Danh sách vật tư");
      xlsx.utils.book_append_sheet(wb, wsInvoices, "Danh sách hóa đơn");

      // Write binary buffer
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader('Content-Disposition', 'attachment; filename=Bao_cao_Duc_Vinh_Solar.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error: any) {
      console.error("GET reports failed:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // --- BANK ACCOUNTS ---
  app.get("/api/bank-accounts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await db.select().from(bankAccounts).orderBy(desc(bankAccounts.id));
      res.json(list);
    } catch (error: any) {
      console.error("GET /api/bank-accounts failed:", error);
      res.status(500).json({ error: "Failed to load bank accounts" });
    }
  });

  app.post("/api/bank-accounts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { accountNumber, bankName, accountName, branch } = req.body;
      if (!accountNumber || !bankName || !accountName) {
        return res.status(400).json({ error: "Account Number, Bank Name, and Account Name are required" });
      }

      const [newAccount] = await db.insert(bankAccounts)
        .values({
          accountNumber: String(accountNumber).trim(),
          bankName: String(bankName).trim(),
          accountName: String(accountName).trim(),
          branch: branch ? String(branch).trim() : null,
        })
        .returning();

      res.status(201).json(newAccount);
    } catch (error: any) {
      console.error("POST /api/bank-accounts failed:", error);
      res.status(500).json({ error: "Failed to create bank account" });
    }
  });

  app.put("/api/bank-accounts/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { accountNumber, bankName, accountName, branch } = req.body;
      if (!accountNumber || !bankName || !accountName) {
        return res.status(400).json({ error: "Account Number, Bank Name, and Account Name are required" });
      }

      const [updated] = await db.update(bankAccounts)
        .set({
          accountNumber: String(accountNumber).trim(),
          bankName: String(bankName).trim(),
          accountName: String(accountName).trim(),
          branch: branch ? String(branch).trim() : null,
        })
        .where(eq(bankAccounts.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Bank account not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("PUT /api/bank-accounts failed:", error);
      res.status(500).json({ error: "Failed to update bank account" });
    }
  });

  app.delete("/api/bank-accounts/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
      res.json({ message: "Bank account deleted successfully" });
    } catch (error: any) {
      console.error("DELETE /api/bank-accounts failed:", error);
      res.status(500).json({ error: "Failed to delete bank account" });
    }
  });

  // Serve static assets / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
