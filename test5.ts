import { generateToken } from './src/lib/auth';
const token = generateToken({ id: 1, email: 'admin@test.com', role: 'admin' });

async function run() {
  const res = await fetch('http://localhost:3000/api/invoices?isDeleted=true', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  console.log(res.status);
  const data = await res.json();
  console.log("Invoices:", data.invoices?.length, data.error);
}
run();
