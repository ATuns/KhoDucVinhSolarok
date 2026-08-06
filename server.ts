import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
	@@ -93,7 +92,7 @@ async function startServer() {
  }

  // Generate code and number for a new invoice
async function generateInvoiceCodes(status: string, targetDate: Date = new Date()) {
    const now = typeof targetDate !== "undefined" ? targetDate : new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
	@@ -1466,7 +1465,7 @@ async function generateInvoiceCodes(status: string, targetDate: Date = new Date(
          return res.status(400).json({ error: "Hóa đơn đã ghi sổ. Vui lòng BỎ GHI SỔ trước khi chỉnh sửa danh sách sản phẩm." });
        }

             
        const oldCreatedAt = existing.createdAt ? new Date(existing.createdAt) : new Date();
        const newCreatedAt = createdAt ? new Date(createdAt) : oldCreatedAt;

	@@ -1492,8 +1491,7 @@ async function generateInvoiceCodes(status: string, targetDate: Date = new Date(

        const originalInvoiceNumber = invoiceNumber !== undefined ? (String(invoiceNumber).trim() || "0") : existing.invoiceNumber;
        const finalInvoiceNumber = dateChanged ? updateCodeWithNewDate(originalInvoiceNumber, newCreatedAt) : originalInvoiceNumber;

        // Update basic fields
        await db.update(invoices)
          .set({
            invoiceNumber: finalInvoiceNumber,
	@@ -1529,8 +1527,8 @@ async function generateInvoiceCodes(status: string, targetDate: Date = new Date(
            });
          }
        }
        let totalAmount = existing.totalAmount;

        // If we are in draft mode and items are sent, recreate them
        if (!existing.isRecorded && items && Array.isArray(items)) {
          // Delete existing items
	@@ -1800,15 +1798,15 @@ async function generateInvoiceCodes(status: string, targetDate: Date = new Date(
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
