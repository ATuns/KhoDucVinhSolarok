#!/bin/bash
sed -i 's/const { name, phone, address } = req.body;/const { name, phone, address, taxId } = req.body;/g' server.ts
sed -i 's/address: address ? address.trim() : null,/address: address ? address.trim() : null,\n          taxId: taxId ? taxId.trim() : null,/g' server.ts
