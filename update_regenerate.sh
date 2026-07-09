#!/bin/bash
cat << 'INNER_EOF' > regenerate_script.cjs
const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const invoiceRegEx = /async function getRegeneratedDocumentCode\(invoiceId: number, newStatus: string\) \{([\s\S]*?)return \`CK-\$\{yymmdd\}-\$\{xxx\}\`;\n    \}\n  \}/;

const newInvoiceFunc = `async function getRegeneratedDocumentCode(invoiceId: number, newStatus: string) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error("Invoice not found");
    
    const date = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    const yyyymmdd = \`\${yyyy}\${mm}\${dd}\`;
    const yymmdd = \`\${String(yyyy).slice(-2)}\${mm}\${dd}\`;
    
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
          documentCode = \`CTT-\${yyyymmdd}-\${xxx}\`;
        } else if (newStatus === 'TM') {
          documentCode = \`TM-\${yymmdd}-\${xxx}\`;
        } else {
          documentCode = \`CK-\${yymmdd}-\${xxx}\`;
        }
        
        const existing = await db.select({id: invoices.id}).from(invoices).where(eq(invoices.documentCode, documentCode));
        if (existing.length === 0 || existing[0].id === invoiceId) {
            break;
        }
        attempt++;
    }
    
    return documentCode;
  }`;

serverCode = serverCode.replace(invoiceRegEx, newInvoiceFunc);

const poRegEx = /async function getRegeneratedPODocumentCode\(poId: number, newStatus: string\) \{([\s\S]*?)return \`PN-CK-\$\{yymmdd\}-\$\{xxx\}\`;\n    \}\n  \}/;

const newPOFunc = `async function getRegeneratedPODocumentCode(poId: number, newStatus: string) {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
    if (!po) throw new Error("PO not found");
    
    const date = po.createdAt ? new Date(po.createdAt) : new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    const yyyymmdd = \`\${yyyy}\${mm}\${dd}\`;
    const yymmdd = \`\${String(yyyy).slice(-2)}\${mm}\${dd}\`;
    
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
          documentCode = \`PN-CTT-\${yyyymmdd}-\${xxx}\`;
        } else if (newStatus === 'TM') {
          documentCode = \`PN-TM-\${yymmdd}-\${xxx}\`;
        } else {
          documentCode = \`PN-CK-\${yymmdd}-\${xxx}\`;
        }
        
        const existing = await db.select({id: purchaseOrders.id}).from(purchaseOrders).where(eq(purchaseOrders.documentCode, documentCode));
        if (existing.length === 0 || existing[0].id === poId) {
            break;
        }
        attempt++;
    }
    
    return documentCode;
  }`;

serverCode = serverCode.replace(poRegEx, newPOFunc);

fs.writeFileSync('server.ts', serverCode);
INNER_EOF

node regenerate_script.cjs
