import http from 'http';

http.get('http://localhost:3000/api/debts', {
  headers: { 'Authorization': 'Bearer test' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  });
});
