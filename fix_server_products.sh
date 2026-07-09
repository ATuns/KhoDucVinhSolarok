#!/bin/bash
# Remove everything between // --- PRODUCTS --- and // --- SUPPLIERS ---
sed -i '/\/\/ --- PRODUCTS ---/,/\/\/ --- SUPPLIERS ---/c\
  // --- PRODUCTS ---\
  app.get("/api/products", requireAuth, async (req: AuthRequest, res) => {\
    try {\
      const { search, lowStock, inStock, warehouseId } = req.query;\
      let conditions = [];\
      conditions.push(eq(products.isHidden, false));\
      if (warehouseId) conditions.push(eq(products.warehouseId, Number(warehouseId)));\
      if (search) {\
        const searchPattern = `%\${search}%`;\
        conditions.push(or(\
          like(products.name, searchPattern),\
          like(products.code, searchPattern),\
          like(products.category, searchPattern)\
        ));\
      }\
      if (lowStock === "true") conditions.push(sql`${products.quantity} <= ${products.minStock}`);\
      if (inStock === "true") conditions.push(sql`${products.quantity} > 0`);\
      const query = db.select().from(products);\
      if (conditions.length > 0) query.where(and(...conditions));\
      const result = await query.orderBy(desc(products.id));\
      res.json(result);\
    } catch (error: any) {\
      console.error("GET /api/products failed:", error);\
      res.status(500).json({ error: "Failed to load products" });\
    }\
  });\
\
  app.post("/api/products", requireAuth, async (req: AuthRequest, res) => {\
    try {\
      const { code, name, category, unit, quantity, price, minStock, warehouseId } = req.body;\
      if (!code || !name || !warehouseId) return res.status(400).json({ error: "Code, Name and Warehouse are required" });\
      const [existing] = await db.select().from(products).where(eq(products.code, code));\
      if (existing) return res.status(400).json({ error: "Product code already exists" });\
      const [newProd] = await db.insert(products)\
        .values({\
          code,\
          name,\
          category: category || "Chưa phân loại",\
          unit: unit || "",\
          quantity: Number(quantity) || 0,\
          price: Number(price) || 0,\
          minStock: Number(minStock) || 10,\
          warehouseId: Number(warehouseId)\
        })\
        .returning();\
      if (newProd.quantity > 0) {\
        await db.insert(stockTransactions).values({\
          productId: newProd.id,\
          type: "NHAP",\
          quantity: newProd.quantity,\
          note: "Nhập tồn kho khởi tạo khi thêm mới sản phẩm",\
          userEmail: req.user?.email || "system",\
          warehouseId: Number(warehouseId)\
        });\
      }\
      res.status(201).json(newProd);\
    } catch (error: any) {\
      console.error("POST /api/products failed:", error);\
      res.status(500).json({ error: "Failed to create product" });\
    }\
  });\
\
  app.put("/api/products/:id", requireAuth, async (req: AuthRequest, res) => {\
    try {\
      const id = parseInt(req.params.id);\
      const { code, name, category, unit, price, quantity, minStock } = req.body;\
      if (!code || !name) return res.status(400).json({ error: "Code and Name are required" });\
      const updateData: any = {\
        code, name, category,\
        unit: unit || "",\
        price: Number(price) || 0,\
        minStock: Number(minStock) || 0,\
        updatedAt: new Date(),\
      };\
      if (quantity !== undefined) updateData.quantity = Number(quantity);\
      const [updated] = await db.update(products).set(updateData).where(eq(products.id, id)).returning();\
      if (!updated) return res.status(404).json({ error: "Product not found" });\
      res.json(updated);\
    } catch (error: any) {\
      console.error("PUT /api/products failed:", error);\
      res.status(500).json({ error: "Failed to update product" });\
    }\
  });\
\
  app.patch("/api/products/:id/hide", requireAuth, async (req: AuthRequest, res) => {\
    try {\
      const id = parseInt(req.params.id);\
      const [updated] = await db.update(products).set({ isHidden: true, updatedAt: new Date() }).where(eq(products.id, id)).returning();\
      if (!updated) return res.status(404).json({ error: "Product not found" });\
      res.json({ message: "Product hidden successfully" });\
    } catch (error: any) {\
      console.error("PATCH /api/products/:id/hide failed:", error);\
      res.status(500).json({ error: "Failed to hide product" });\
    }\
  });\
\
  app.post("/api/products/stock-transaction", requireAuth, async (req: AuthRequest, res) => {\
    try {\
      const { productId, type, quantity, note, warehouseId } = req.body;\
      const qty = Number(quantity);\
      if (!productId || !type || isNaN(qty) || qty <= 0 || !warehouseId) return res.status(400).json({ error: "Invalid request" });\
      const [product] = await db.select().from(products).where(and(eq(products.id, Number(productId)), eq(products.warehouseId, Number(warehouseId))));\
      if (!product) return res.status(404).json({ error: "Product not found in this warehouse" });\
      let newQty = product.quantity;\
      if (type === "NHAP") {\
        newQty += qty;\
      } else if (type === "XUAT") {\
        if (product.quantity < qty) return res.status(400).json({ error: `Not enough stock (current: ${product.quantity})` });\
        newQty -= qty;\
      } else {\
        return res.status(400).json({ error: "Invalid type" });\
      }\
      await db.update(products).set({ quantity: newQty, updatedAt: new Date() }).where(eq(products.id, product.id));\
      const [tx] = await db.insert(stockTransactions).values({\
        productId: product.id,\
        type,\
        quantity: qty,\
        note: note || (type === "NHAP" ? "Nhập kho thủ công" : "Xuất kho thủ công"),\
        userEmail: req.user?.email || "system",\
        warehouseId: Number(warehouseId)\
      }).returning();\
      res.json({ product: { ...product, quantity: newQty }, transaction: tx });\
    } catch (error: any) {\
      console.error("POST /api/products/stock-transaction failed:", error);\
      res.status(500).json({ error: "Failed to perform stock action" });\
    }\
  });\
\
  app.get("/api/products/:id/transactions", requireAuth, async (req: AuthRequest, res) => {\
    try {\
      const id = parseInt(req.params.id);\
      const [product] = await db.select().from(products).where(eq(products.id, id));\
      if (!product) return res.status(404).json({ error: "Product not found" });\
      const txList = await db.select().from(stockTransactions).where(eq(stockTransactions.productId, id)).orderBy(asc(stockTransactions.id));\
      let runningBalance = 0;\
      const enrichedList = txList.map(tx => {\
        if (tx.type === "NHAP" || tx.type === "BO_GHI_SO") {\
          runningBalance += tx.quantity;\
        } else if (tx.type === "XUAT" || tx.type === "GHI_SO") {\
          runningBalance -= tx.quantity;\
        }\
        return { ...tx, runningBalance };\
      });\
      res.json(enrichedList.reverse());\
    } catch (error: any) {\
      console.error("GET transactions failed:", error);\
      res.status(500).json({ error: "Failed to load history" });\
    }\
  });\
\
  app.post("/api/products/import", requireAuth, async (req: AuthRequest, res) => {\
    try {\
      const { items, warehouseId } = req.body;\
      if (!Array.isArray(items) || items.length === 0 || !warehouseId) return res.status(400).json({ error: "Invalid items or missing warehouseId" });\
      let importedCount = 0;\
      let skippedCount = 0;\
      for (const item of items) {\
        const { code, name, category, unit, quantity, price, minStock } = item;\
        if (!code || !name) { skippedCount++; continue; }\
        const trimmedCode = String(code).trim();\
        if (!trimmedCode) { skippedCount++; continue; }\
        const [existing] = await db.select().from(products).where(eq(products.code, trimmedCode));\
        if (existing) { skippedCount++; continue; }\
        const qty = Number(quantity) || 0;\
        const prc = Math.round(Number(price)) || 0;\
        const mst = Math.round(Number(minStock)) || 10;\
        const [newProd] = await db.insert(products)\
          .values({\
            code: trimmedCode,\
            name: String(name).trim(),\
            category: category ? String(category).trim() : "Chưa phân loại",\
            unit: unit ? String(unit).trim() : "",\
            quantity: qty,\
            price: prc,\
            minStock: mst,\
            warehouseId: Number(warehouseId)\
          })\
          .returning();\
        if (qty > 0) {\
          await db.insert(stockTransactions).values({\
            productId: newProd.id,\
            type: "NHAP",\
            quantity: qty,\
            note: "Nhập tồn kho khởi tạo từ import Excel",\
            userEmail: req.user?.email || "system",\
            warehouseId: Number(warehouseId)\
          });\
        }\
        importedCount++;\
      }\
      res.json({ message: "Import completed", importedCount, skippedCount });\
    } catch (error: any) {\
      console.error("POST /api/products/import failed:", error);\
      res.status(500).json({ error: "Failed to import products" });\
    }\
  });\
\
  // --- SUPPLIERS ---' server.ts
