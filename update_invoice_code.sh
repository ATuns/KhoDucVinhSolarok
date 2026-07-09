#!/bin/bash
cat << 'INNER_EOF' > invoice_code_script.cjs
const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const regex = /async function generateInvoiceCodes\(status: string\) \{([\s\S]*?)return \{ documentCode, invoiceNumber \};\n  \}/;

const newFunc = `async function generateInvoiceCodes(status: string) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    
    const yyyymmdd = \`\${yyyy}\${mm}\${dd}\`;
    const yymmdd = \`\${String(yyyy).slice(-2)}\${mm}\${dd}\`;
    
    // Daily sequence based on invoices created today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayInvoices = await db.select({ documentCode: invoices.documentCode })
      .from(invoices)
      .where(and(
        sql\`\${invoices.createdAt} >= \${startOfDay}\`,
        sql\`\${invoices.createdAt} <= \${endOfDay}\`
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
          documentCode = \`CTT-\${yyyymmdd}-\${xxx}\`;
        } else if (status === 'TM') {
          documentCode = \`TM-\${yymmdd}-\${xxx}\`;
        } else {
          documentCode = \`CK-\${yymmdd}-\${xxx}\`;
        }
        
        invoiceNumber = \`HD-\${yyyymmdd}-\${xxx}\`;
        
        const existing = await db.select({id: invoices.id}).from(invoices).where(eq(invoices.documentCode, documentCode));
        if (existing.length === 0) {
            break;
        }
        attempt++;
    }
    
    return { documentCode, invoiceNumber };
  }`;

serverCode = serverCode.replace(regex, newFunc);
fs.writeFileSync('server.ts', serverCode);
INNER_EOF

node invoice_code_script.cjs
