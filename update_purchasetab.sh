#!/bin/bash
sed -i 's/const \[newCustAddress, setNewCustAddress\] = useState('"'"''"'"');/const \[newCustAddress, setNewCustAddress\] = useState('"'"''"'"');\n  const \[newCustTaxId, setNewCustTaxId\] = useState('"'"''"'"');/g' src/components/PurchaseTab.tsx
sed -i 's/address: newCustAddress.trim() || null/address: newCustAddress.trim() || null,\n          taxId: newCustTaxId.trim() || null/g' src/components/PurchaseTab.tsx
