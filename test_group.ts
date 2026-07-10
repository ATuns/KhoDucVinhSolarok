const txList = [
  { id: 1, docNumber: 'INV-001', type: 'GHI_SO', quantity: 5 },
  { id: 2, docNumber: 'INV-001', type: 'GHI_SO', quantity: 3 },
  { id: 3, docNumber: null, type: 'NHAP', quantity: 10 }
];

const groupedTxs = [];
const docTypeMap = new Map();

for (const tx of txList) {
  if (tx.docNumber) {
    const key = `${tx.docNumber}_${tx.type}`;
    if (docTypeMap.has(key)) {
      docTypeMap.get(key).quantity += tx.quantity;
    } else {
      const newTx = { ...tx };
      docTypeMap.set(key, newTx);
      groupedTxs.push(newTx);
    }
  } else {
    groupedTxs.push(tx);
  }
}

console.log(groupedTxs);
