#!/bin/bash
sed -i 's/const \[formAddress, setFormAddress\] = useState('"'"''"'"');/const \[formAddress, setFormAddress\] = useState('"'"''"'"');\n  const \[formTaxId, setFormTaxId\] = useState('"'"''"'"');/g' src/components/CustomersTab.tsx
sed -i 's/setFormAddress(partner.address || '"'"''"'"');/setFormAddress(partner.address || '"'"''"'"');\n    setFormTaxId(partner.taxId || '"'"''"'"');/g' src/components/CustomersTab.tsx
sed -i 's/setFormAddress('"'"''"'"');/setFormAddress('"'"''"'"');\n    setFormTaxId('"'"''"'"');/g' src/components/CustomersTab.tsx
sed -i 's/address: formAddress/address: formAddress,\n          taxId: formTaxId/g' src/components/CustomersTab.tsx
