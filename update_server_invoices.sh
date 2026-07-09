#!/bin/bash
sed -i 's/customerAddress: customers.address,/customerAddress: customers.address,\n        customerTaxId: customers.taxId,/g' server.ts
