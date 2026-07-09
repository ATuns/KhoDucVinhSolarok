import { Router } from "express";
import { db, getIsUnaccentSupported } from "../db/index.ts";
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderDeposits,
  purchaseOrderLogs,
  suppliers,
  products,
  users,
  stockTransactions,
  warehouseStocks
} from "../db/schema.ts";
import { eq, like, and, or, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.ts";

export const purchaseOrdersRouter = Router();

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

async function generatePOCodes(status: string) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  
  const yyyymmdd = `${yyyy}${mm}${dd}`;
  const yymmdd = `${String(yyyy).slice(-2)}${mm}${dd}`;
  
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

async function getRegeneratedPODocumentCode(poId: number, newStatus: string) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) throw new Error("PO not found");
  
  const date = po.createdAt ? new Date(po.createdAt) : new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  const yyyymmdd = `${yyyy}${mm}${dd}`;
  const yymmdd = `${String(yyyy).slice(-2)}${mm}${dd}`;
  
  let xxx = '001';
  const parts = po.documentCode.split('-');
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 3 && !isNaN(Number(lastPart))) {
      xxx = lastPart;
    }
  }
  
  if (newStatus === 'CTT') {
    return `PN-CTT-${yyyymmdd}-${xxx}`;
  } else if (newStatus === 'TM') {
    return `PN-TM-${yymmdd}-${xxx}`;
  } else {
    return `PN-CK-${yymmdd}-${xxx}`;
  }
}

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

purchaseOrdersRouter.get("/purchase-orders", requireAuth as any, async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const { search, status, isRecorded, startDate, endDate, sort } = req.query;

    let conditions = [];

    if (isRecorded !== undefined) {
      conditions.push(eq(purchaseOrders.isRecorded, isRecorded === 'true'));
    }

    if (status) {
      if (status === 'CK') {
        conditions.push(
          or(
            eq(purchaseOrders.status, 'CK'),
            like(purchaseOrders.status, 'CK - %')
          )
        );
      } else {
        conditions.push(eq(purchaseOrders.status, status as string));
      }
    }

    if (startDate) {
      conditions.push(gte(purchaseOrders.createdAt, new Date(startDate as string)));
    }

    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(purchaseOrders.createdAt, end));
    }

    if (search) {
      const words = (search as string).split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        if (getIsUnaccentSupported()) {
          const wordConditions = words.map(word => {
            const pattern = `%${word}%`;
            return or(
              sql`unaccent(COALESCE(${purchaseOrders.poNumber}, '')) ILIKE unaccent(${pattern}::text)`,
              sql`unaccent(COALESCE(${purchaseOrders.documentCode}, '')) ILIKE unaccent(${pattern}::text)`,
              sql`unaccent(COALESCE(${purchaseOrders.customSupplierName}, '')) ILIKE unaccent(${pattern}::text)`,
              sql`unaccent(COALESCE(${suppliers.name}, '')) ILIKE unaccent(${pattern}::text)`,
              sql`unaccent(COALESCE(${suppliers.phone}, '')) ILIKE unaccent(${pattern}::text)`,
              sql`unaccent(COALESCE(${suppliers.taxId}, '')) ILIKE unaccent(${pattern}::text)`
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
              sql`translate(COALESCE(${purchaseOrders.poNumber}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
              sql`translate(COALESCE(${purchaseOrders.documentCode}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
              sql`translate(COALESCE(${purchaseOrders.customSupplierName}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
              sql`translate(COALESCE(${suppliers.name}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
              sql`translate(COALESCE(${suppliers.phone}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`,
              sql`translate(COALESCE(${suppliers.taxId}, ''), ${VI_ACCENTS}, ${VI_NON_ACCENTS}) ILIKE ${cleanPattern}`
            );
          });
          conditions.push(and(...wordConditions));
        }
      }
    }

    const filterClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ 
      count: sql<number>`count(*)::int`,
      sumAmount: sql<any>`sum(${purchaseOrders.totalAmount} - CASE WHEN ${purchaseOrders.depositEnabled} = TRUE THEN COALESCE((SELECT sum(amount) FROM purchase_order_deposits WHERE po_id = ${purchaseOrders.id}), 0) ELSE 0 END)::numeric`
    })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(filterClause);
    const total = countResult ? Number(countResult.count) : 0;
    const totalAmountSum = countResult && countResult.sumAmount ? Number(countResult.sumAmount) : 0;

    const list = await db.select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      documentCode: purchaseOrders.documentCode,
      status: purchaseOrders.status,
      isRecorded: purchaseOrders.isRecorded,
      depositEnabled: purchaseOrders.depositEnabled,
      totalAmount: purchaseOrders.totalAmount,
      totalDeposits: sql<number>`COALESCE((SELECT sum(amount) FROM purchase_order_deposits WHERE po_id = ${purchaseOrders.id}), 0)::int`,
      createdAt: purchaseOrders.createdAt,
      supplierId: purchaseOrders.supplierId,
      supplierName: sql<string>`COALESCE(${purchaseOrders.customSupplierName}, ${suppliers.name})`,
      supplierPhone: suppliers.phone,
      supplierAddress: suppliers.address,
      supplierTaxId: suppliers.taxId,
      createdByEmail: users.email,
      customSupplierName: purchaseOrders.customSupplierName,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(users, eq(purchaseOrders.createdBy, users.id))
    .where(filterClause)
    .orderBy(sort === 'asc' ? asc(purchaseOrders.createdAt) : desc(purchaseOrders.createdAt))
    .limit(limit)
    .offset(offset);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalAmountSum,
      purchaseOrders: list,
    });
  } catch (error: any) {
    console.error("GET /api/purchase-orders failed:", error);
    res.status(500).json({ error: "Failed to load purchase orders" });
  }
});

purchaseOrdersRouter.get("/purchase-orders/:id", requireAuth as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    
    const [po] = await db.select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      documentCode: purchaseOrders.documentCode,
      supplierId: purchaseOrders.supplierId,
      status: purchaseOrders.status,
      bankAccountId: purchaseOrders.bankAccountId,
      isRecorded: purchaseOrders.isRecorded,
      depositEnabled: purchaseOrders.depositEnabled,
      totalAmount: purchaseOrders.totalAmount,
      createdAt: purchaseOrders.createdAt,
      updatedAt: purchaseOrders.updatedAt,
      supplierName: sql<string>`COALESCE(${purchaseOrders.customSupplierName}, ${suppliers.name})`,
      supplierPhone: suppliers.phone,
      supplierAddress: suppliers.address,
      supplierTaxId: suppliers.taxId,
      createdByEmail: users.email,
      customSupplierName: purchaseOrders.customSupplierName,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(users, eq(purchaseOrders.createdBy, users.id))
    .where(eq(purchaseOrders.id, id));

    if (!po) return res.status(404).json({ error: "Purchase Order not found" });

    const items = await db.select({
        id: purchaseOrderItems.id,
        poId: purchaseOrderItems.poId,
        productId: purchaseOrderItems.productId,
        productName: purchaseOrderItems.productName,
        productCode: purchaseOrderItems.productCode,
        unit: purchaseOrderItems.unit,
        quantity: purchaseOrderItems.quantity,
        price: purchaseOrderItems.price,
        totalPrice: purchaseOrderItems.totalPrice,
        hasVat: purchaseOrderItems.hasVat,
        vatRate: purchaseOrderItems.vatRate,
        warehouseId: purchaseOrderItems.warehouseId
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(eq(purchaseOrderItems.poId, id));
    const poDeposits = await db.select().from(purchaseOrderDeposits).where(eq(purchaseOrderDeposits.poId, id));
    const logs = await db.select().from(purchaseOrderLogs).where(eq(purchaseOrderLogs.poId, id)).orderBy(desc(purchaseOrderLogs.createdAt));

    res.json({ ...po, items, deposits: poDeposits, logs });
  } catch (error: any) {
    console.error("GET /api/purchase-orders/:id failed:", error);
    res.status(500).json({ error: "Failed to load purchase order details" });
  }
});

purchaseOrdersRouter.post("/purchase-orders", requireAuth as any, async (req: any, res: any) => {
  try {
    const { supplierId, customSupplierName, status, isRecorded, depositEnabled, items, createdAt, purchaseOrderNumberCustom } = req.body;
    const userEmail = req.user?.email || 'Unknown';
    const userId = req.user?.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Purchase order must have at least one item" });
    }

    let { documentCode, poNumber } = await generatePOCodes(status);
    
    if (purchaseOrderNumberCustom && purchaseOrderNumberCustom.trim() !== '') {
      poNumber = purchaseOrderNumberCustom.trim();
    } else {
      poNumber = "0";
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

    const [newPO] = await db.insert(purchaseOrders).values({
      poNumber,
      documentCode,
      supplierId: supplierId ? Number(supplierId) : null,
      customSupplierName: customSupplierName || null,
      status,
      isRecorded: !!isRecorded,
      depositEnabled: !!depositEnabled,
      totalAmount,
      createdBy: userId,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    }).returning();

    for (const item of items) {
      const itemTotal = item.quantity * item.price;
      await db.insert(purchaseOrderItems).values({
        poId: newPO.id,
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        unit: item.unit ? String(item.unit) : "",
        quantity: item.quantity,
        price: item.price,
        totalPrice: itemTotal,
        hasVat: Boolean(item.hasVat),
        vatRate: item.vatRate ? Number(item.vatRate) : 0,
        warehouseId: item.warehouseId ? Number(item.warehouseId) : null,
      });

      if (newPO.isRecorded) {
        if (item.productId) {
          const [product] = await db.select().from(products).where(eq(products.id, item.productId));
          if (product) {
            const newQty = product.quantity + item.quantity; // Nhập kho -> Tăng số lượng
            await db.update(products).set({ quantity: newQty }).where(eq(products.id, item.productId));
            
            let partnerName = null;
            if (newPO.supplierId) {
              const [supp] = await db.select().from(suppliers).where(eq(suppliers.id, newPO.supplierId));
              if (supp) partnerName = supp.name;
            }
            await db.insert(stockTransactions).values({
              productId: item.productId,
              type: 'NHAP', // Changed to NHAP
              quantity: item.quantity,
              note: `Ghi sổ phiếu nhập hàng ${newPO.poNumber} (${newPO.documentCode})`,
              userEmail,
              docNumber: newPO.documentCode,
              partnerName: partnerName,
              unitPrice: item.price,
              warehouseId: item.warehouseId || null,
              createdAt: newPO.createdAt ? new Date(newPO.createdAt) : new Date()
            });
          }
        }
      }
    }

    await logPOAction(newPO.id, 'TẠO MỚI', `Tạo phiếu nhập mới ${newPO.poNumber}`, userEmail);
    if (newPO.isRecorded) {
      await logPOAction(newPO.id, 'GHI SỔ', `Ghi sổ phiếu nhập hàng, cộng số lượng kho`, userEmail);
    }

    res.status(201).json(newPO);
  } catch (error: any) {
    console.error("POST /api/purchase-orders failed:", error);
    res.status(500).json({ error: "Failed to create purchase order" });
  }
});

purchaseOrdersRouter.post("/purchase-orders/create-blank", requireAuth as any, async (req: any, res: any) => {
  try {
    const codes = await generatePOCodes('CTT');
    const [newPO] = await db.insert(purchaseOrders).values({
      poNumber: "0",
      documentCode: codes.documentCode,
      status: 'CTT',
      isRecorded: false,
      totalAmount: 0
    }).returning();
    
    await logPOAction(newPO.id, 'TẠO MỚI', 'Tạo phiếu nhập mới (trống)', req.user?.email || 'Unknown');
    res.json(newPO);
  } catch (error) {
    console.error("POST /api/purchase-orders/create-blank failed:", error);
    res.status(500).json({ error: "Failed to create blank purchase order" });
  }
});

purchaseOrdersRouter.put("/purchase-orders/:id", requireAuth as any, async (req: any, res: any) => {
  let retries = 3;
  while (retries > 0) {
    try {
      const id = parseInt(req.params.id);
      const { supplierId, customSupplierName, status, depositEnabled, items, poNumber, documentCode, createdAt, deposits: bodyDeposits, bankAccountId } = req.body;
      const userEmail = req.user?.email || 'Unknown';

      const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      if (existing.isRecorded && items && Array.isArray(items)) {
        return res.status(400).json({ error: "Phiếu nhập đã ghi sổ. Vui lòng BỎ GHI SỔ trước khi chỉnh sửa danh sách sản phẩm." });
      }

      let totalAmount = existing.totalAmount;
      if (items && Array.isArray(items)) {
        totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
      }

      let updateStatus = existing.status;
      let newDocumentCode = existing.documentCode;

      if (status && status !== existing.status) {
        updateStatus = status;
        newDocumentCode = await getRegeneratedPODocumentCode(id, status);
      }

      const newCreatedAt = createdAt ? new Date(createdAt) : (existing.createdAt ? new Date(existing.createdAt) : new Date());

      newDocumentCode = updateCodeWithNewDate(newDocumentCode, newCreatedAt);
      const originalPoNumber = poNumber !== undefined ? (String(poNumber).trim() || "0") : existing.poNumber;
      const finalPoNumber = updateCodeWithNewDate(originalPoNumber, newCreatedAt);

      await db.update(purchaseOrders)
        .set({
          poNumber: finalPoNumber,
          documentCode: newDocumentCode,
          supplierId: supplierId ? Number(supplierId) : existing.supplierId,
          customSupplierName: customSupplierName !== undefined ? customSupplierName : existing.customSupplierName,
          status: updateStatus,
          bankAccountId: bankAccountId !== undefined ? (bankAccountId ? Number(bankAccountId) : null) : existing.bankAccountId,
          depositEnabled: depositEnabled !== undefined ? !!depositEnabled : existing.depositEnabled,
          createdAt: newCreatedAt,
          totalAmount,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id));

      // Update corresponding stock transactions if any exist
      await db.update(stockTransactions)
        .set({
          createdAt: newCreatedAt,
          docNumber: newDocumentCode
        })
        .where(eq(stockTransactions.docNumber, existing.documentCode));

      // Handle deposits recreation
      if (bodyDeposits && Array.isArray(bodyDeposits)) {
        await db.delete(purchaseOrderDeposits).where(eq(purchaseOrderDeposits.poId, id));
        for (const dep of bodyDeposits) {
          await db.insert(purchaseOrderDeposits).values({
            poId: id,
            amount: Math.max(0, Number(dep.amount)),
            paymentMethod: dep.paymentMethod || 'CK',
            note: dep.note ? String(dep.note).trim() : null,
            createdAt: dep.createdAt ? new Date(dep.createdAt) : new Date(),
          });
        }
      }

      if (!existing.isRecorded && items && Array.isArray(items)) {
        await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.poId, id));

        for (const item of items) {
          const itemTotal = item.quantity * item.price;
          await db.insert(purchaseOrderItems).values({
            poId: id,
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            unit: item.unit ? String(item.unit) : "",
            quantity: item.quantity,
            price: item.price,
            totalPrice: itemTotal,
            hasVat: Boolean(item.hasVat),
            vatRate: item.vatRate ? Number(item.vatRate) : 0,
            warehouseId: item.warehouseId ? Number(item.warehouseId) : null,
          });
        }
      }

      await logPOAction(id, 'CHỈNH SỬA', `Chỉnh sửa thông tin phiếu nhập hàng`, userEmail);

      return res.json({ message: "Purchase order updated successfully" });
    } catch (error: any) {
      if (error.code === '40001' || error.message.includes('deadlock')) {
        retries--;
        if (retries === 0) throw error;
        await new Promise(r => setTimeout(r, 100)); // wait 100ms before retry
      } else {
        console.error("PUT /api/purchase-orders/:id failed:", error);
        return res.status(500).json({ error: "Failed to update purchase order", details: error.message });
      }
    }
  }
});

purchaseOrdersRouter.delete("/purchase-orders/:id", requireAuth as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (existing.isRecorded) {
      return res.status(400).json({ error: "Phiếu nhập đã ghi sổ. Vui lòng bỏ ghi sổ trước khi xóa." });
    }

    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    res.json({ message: "Purchase order deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/purchase-orders/:id failed:", error);
    res.status(500).json({ error: "Failed to delete purchase order" });
  }
});

purchaseOrdersRouter.post("/purchase-orders/:id/record", requireAuth as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const userEmail = req.user?.email || 'Unknown';

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (existing.isRecorded) {
      return res.status(400).json({ error: "Purchase order is already recorded" });
    }

    await db.update(purchaseOrders).set({ isRecorded: true }).where(eq(purchaseOrders.id, id));

    const items = await db.select({
        id: purchaseOrderItems.id,
        poId: purchaseOrderItems.poId,
        productId: purchaseOrderItems.productId,
        productName: purchaseOrderItems.productName,
        productCode: purchaseOrderItems.productCode,
        unit: purchaseOrderItems.unit,
        quantity: purchaseOrderItems.quantity,
        price: purchaseOrderItems.price,
        totalPrice: purchaseOrderItems.totalPrice,
        hasVat: purchaseOrderItems.hasVat,
        vatRate: purchaseOrderItems.vatRate,
        warehouseId: purchaseOrderItems.warehouseId
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(eq(purchaseOrderItems.poId, id));
    
    
    for (const item of items) {
      if (item.productId) {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        if (product) {
          const newQty = product.quantity + item.quantity; // Nhập hàng -> cộng vào kho tổng
          await db.update(products).set({ quantity: newQty }).where(eq(products.id, item.productId));
          
          let partnerName = null;
          if (existing.supplierId) {
            const [supp] = await db.select().from(suppliers).where(eq(suppliers.id, existing.supplierId));
            if (supp) partnerName = supp.name;
          }
          await db.insert(stockTransactions).values({
            productId: item.productId,
            type: 'NHAP',
            quantity: item.quantity,
            note: `Ghi sổ phiếu nhập hàng ${existing.poNumber} (${existing.documentCode})`,
            userEmail,
            warehouseId: item.warehouseId || null,
            docNumber: existing.documentCode,
            partnerName: partnerName,
            unitPrice: item.price,
            createdAt: existing.createdAt ? new Date(existing.createdAt) : new Date()
          });
        } else {
        }
      } else {
      }
    }

    await logPOAction(id, 'GHI SỔ', `Ghi sổ phiếu nhập hàng, cộng số lượng kho`, userEmail);

    res.json({ message: "Purchase order recorded successfully" });
  } catch (error: any) {
    console.error("POST /api/purchase-orders/:id/record failed:", error);
    res.status(500).json({ error: "Failed to record purchase order" });
  }
});

purchaseOrdersRouter.post("/purchase-orders/:id/unrecord", requireAuth as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const userEmail = req.user?.email || 'Unknown';

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (!existing.isRecorded) {
      return res.status(400).json({ error: "Purchase order is not recorded yet" });
    }

    const items = await db.select({
        id: purchaseOrderItems.id,
        poId: purchaseOrderItems.poId,
        productId: purchaseOrderItems.productId,
        productName: purchaseOrderItems.productName,
        productCode: purchaseOrderItems.productCode,
        unit: purchaseOrderItems.unit,
        quantity: purchaseOrderItems.quantity,
        price: purchaseOrderItems.price,
        totalPrice: purchaseOrderItems.totalPrice,
        hasVat: purchaseOrderItems.hasVat,
        vatRate: purchaseOrderItems.vatRate,
        warehouseId: purchaseOrderItems.warehouseId
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(eq(purchaseOrderItems.poId, id));

    // Verification: Ensure enough stock exists BEFORE subtracting
    for (const item of items) {
      if (item.productId) {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        if (!product) {
          return res.status(400).json({ error: `Sản phẩm với mã ${item.productCode} không tồn tại trong kho.` });
        }
        if (product.quantity < item.quantity) {
          return res.status(400).json({
            error: `Không thể bỏ ghi sổ. Sản phẩm "${item.productName}" (Mã: ${item.productCode}) hiện chỉ còn tồn kho thực tế: ${product.quantity}, không đủ để hoàn trả (cần giảm ${item.quantity}). Vui lòng kiểm tra lại.`
          });
        }
      }
    }

    await db.update(purchaseOrders).set({ isRecorded: false }).where(eq(purchaseOrders.id, id));
    
    for (const item of items) {
      if (item.productId) {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        if (product) {
          const newQty = product.quantity - item.quantity; // Bỏ ghi sổ nhập hàng -> trừ khỏi kho tổng
          await db.update(products).set({ quantity: newQty }).where(eq(products.id, item.productId));
          
          await db.delete(stockTransactions)
            .where(
              and(
                eq(stockTransactions.productId, item.productId),
                eq(stockTransactions.type, 'NHAP'),
                eq(stockTransactions.docNumber, existing.documentCode)
              )
            );
        }
      }
    }

    await logPOAction(id, 'BỎ GHI SỔ', `Bỏ ghi sổ phiếu nhập hàng, hoàn lại số lượng kho`, userEmail);

    res.json({ message: "Purchase order unrecorded successfully" });
  } catch (error: any) {
    console.error("POST /api/purchase-orders/:id/unrecord failed:", error);
    res.status(500).json({ error: "Failed to unrecord purchase order" });
  }
});

purchaseOrdersRouter.post("/purchase-orders/:id/duplicate", requireAuth as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const userEmail = req.user?.email || 'Unknown';
    const userId = req.user?.id;

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const items = await db.select({
        id: purchaseOrderItems.id,
        poId: purchaseOrderItems.poId,
        productId: purchaseOrderItems.productId,
        productName: purchaseOrderItems.productName,
        productCode: purchaseOrderItems.productCode,
        unit: purchaseOrderItems.unit,
        quantity: purchaseOrderItems.quantity,
        price: purchaseOrderItems.price,
        totalPrice: purchaseOrderItems.totalPrice,
        hasVat: purchaseOrderItems.hasVat,
        vatRate: purchaseOrderItems.vatRate,
        warehouseId: purchaseOrderItems.warehouseId
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(eq(purchaseOrderItems.poId, id));
    
    let { documentCode, poNumber } = await generatePOCodes(existing.status);
    poNumber = "0";

    const [newPO] = await db.insert(purchaseOrders).values({
      poNumber,
      documentCode,
      supplierId: existing.supplierId,
      status: existing.status,
      isRecorded: false,
      depositEnabled: existing.depositEnabled,
      totalAmount: existing.totalAmount,
      createdBy: userId,
    }).returning();

    for (const item of items) {
      await db.insert(purchaseOrderItems).values({
        poId: newPO.id,
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        unit: item.unit ? String(item.unit) : "",
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        hasVat: item.hasVat,
        vatRate: item.vatRate,
      });
    }

    await logPOAction(newPO.id, 'NHÂN BẢN', `Nhân bản từ phiếu nhập hàng #${existing.poNumber}`, userEmail);

    res.json(newPO);
  } catch (error: any) {
    console.error("POST /api/purchase-orders/:id/duplicate failed:", error);
    res.status(500).json({ error: "Failed to duplicate purchase order" });
  }
});

purchaseOrdersRouter.post("/purchase-orders/:id/deposit", requireAuth as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, paymentMethod, note } = req.body;
    const userEmail = req.user?.email || 'Unknown';

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    await db.insert(purchaseOrderDeposits).values({
      poId: id,
      amount,
      paymentMethod,
      note,
    });

    await logPOAction(id, 'THANH TOÁN', `Đã thanh toán: ${Number(amount).toLocaleString()}đ qua ${paymentMethod}. Ghi chú: ${note || 'không có'}.`, userEmail);

    res.json({ message: "Deposit added successfully" });
  } catch (error: any) {
    console.error("POST /api/purchase-orders/:id/deposit failed:", error);
    res.status(500).json({ error: "Failed to add deposit" });
  }
});

purchaseOrdersRouter.post("/purchase-orders/:id/deposits", requireAuth as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, paymentMethod, note } = req.body;
    const userEmail = req.user?.email || 'Unknown';

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    await db.insert(purchaseOrderDeposits).values({
      poId: id,
      amount,
      paymentMethod,
      note,
    });

    await logPOAction(id, 'THANH TOÁN', `Đã thanh toán: ${Number(amount).toLocaleString()}đ qua ${paymentMethod}. Ghi chú: ${note || 'không có'}.`, userEmail);

    res.json({ message: "Deposit added successfully" });
  } catch (error: any) {
    console.error("POST /api/purchase-orders/:id/deposits failed:", error);
    res.status(500).json({ error: "Failed to add deposit" });
  }
});
