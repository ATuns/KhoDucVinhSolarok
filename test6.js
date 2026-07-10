const http = require('http');
const req = http.request('http://localhost:3000/api/invoices?isDeleted=true', {
  headers: {
    Authorization: 'Bearer DucVinh@123'
  }
}, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log("Invoices count:", json.invoices?.length, "Total:", json.total);
  });
});
req.end();
