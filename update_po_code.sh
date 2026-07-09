#!/bin/bash
cat << 'INNER_EOF' > po_code_script.cjs
const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const poRegex = /async function generatePOCodes\(status: string\) \{([\s\S]*?)return \{ documentCode, poNumber \};\n  \}/;

const newPOFunc = `async function generatePOCodes(status: string) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    
    const yyyymmdd = \`\${yyyy}\${mm}\${dd}\`;
    const yymmdd = \`\${String(yyyy).slice(-2)}\${mm}\${dd}\`;
    
    // Daily sequence based on POs created today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayPOs = await db.select({ documentCode: purchaseOrders.documentCode })
      .from(purchaseOrders)
      .where(and(
        sql\`\${purchaseOrders.createdAt} >= \${startOfDay}\`,
        sql\`\${purchaseOrders.createdAt} <= \${endOfDay}\`
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
          documentCode = \`PN-CTT-\${yyyymmdd}-\${xxx}\`;
        } else if (status === 'TM') {
          documentCode = \`PN-TM-\${yymmdd}-\${xxx}\`;
        } else {
          documentCode = \`PN-CK-\${yymmdd}-\${xxx}\`;
        }
        
        poNumber = \`PN-\${yyyymmdd}-\${xxx}\`;
        
        const existing = await db.select({id: purchaseOrders.id}).from(purchaseOrders).where(eq(purchaseOrders.documentCode, documentCode));
        if (existing.length === 0) {
            break;
        }
        attempt++;
    }
    
    return { documentCode, poNumber };
  }`;

serverCode = serverCode.replace(poRegex, newPOFunc);
fs.writeFileSync('server.ts', serverCode);
INNER_EOF

node po_code_script.cjs
