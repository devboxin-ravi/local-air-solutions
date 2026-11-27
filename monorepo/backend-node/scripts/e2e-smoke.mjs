// End-to-end API smoke test. Requires: running API (npm run dev), seeded + demo data (npm run db:seed && npm run db:seed:demo).
// Usage: API_URL=http://localhost:8000/api/v1 ADMIN_PASSWORD=... node scripts/e2e-smoke.mjs
const BASE = process.env.API_URL ?? 'http://localhost:8000/api/v1';
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const today = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const tomorrow = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1));
if (tomorrow.getUTCDay() === 0) tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

// Admin login
let r = await call('POST', '/auth/admin/login', null, { identifier: 'admin@localairsolutions.in', password: process.env.ADMIN_PASSWORD ?? 'ChangeMe@123' });
ok(r.status === 200 && r.json.data.tokens, 'admin login');
const admin = r.json.data.tokens.accessToken;
const refresh = r.json.data.tokens.refreshToken;

r = await call('POST', '/auth/admin/login', null, { identifier: 'admin@localairsolutions.in', password: 'wrong-pass' });
ok(r.status === 401, 'wrong password rejected');

r = await call('POST', '/auth/admin/login', null, { identifier: 'customer@demo.local', password: 'Demo@1234' });
ok(r.status === 401, 'customer cannot log into admin panel');

r = await call('POST', '/auth/refresh', null, { refreshToken: refresh });
ok(r.status === 200, 'refresh rotation');
const r2 = await call('POST', '/auth/refresh', null, { refreshToken: refresh });
ok(r2.status === 401, 'reused refresh token rejected');

r = await call('GET', '/dashboard', admin);
ok(r.status === 200 && r.json.data.kpis, 'dashboard');

r = await call('GET', '/services?pageSize=50', null);
ok(r.status === 200 && r.json.data.length === 36, `public services (${r.json.data?.length})`);
const svc = r.json.data.find((s) => s.code === 'AC-GEN-SVC');

r = await call('GET', '/branches', admin);
// The fixtures below use an Indore (MP) address, which the IDR-01 service area routes to.
const branch = r.json.data.find((b) => b.code === 'IDR-01') ?? r.json.data[0];
r = await call('GET', '/states', null);
const mp = r.json.data.find((s) => s.code === 'MP');
r = await call('GET', `/cities?stateId=${mp.id}`, null);
const city = r.json.data[0];

// Customer create (admin)
const mobile = '9' + String(Date.now()).slice(-9);
r = await call('POST', '/customers', admin, {
  fullName: 'Rahul Verma', mobile, email: `rahul${Date.now()}@example.com`, branchId: branch.id, customerType: 'INDIVIDUAL', status: 'ACTIVE',
  address: { label: 'Home', line1: '45, MG Road, Near City Mall', stateId: mp.id, cityId: city.id, pincode: '452010' },
});
ok(r.status === 201, `create customer ${r.json.error?.message ?? ''}`);
const customer = r.json.data;
r = await call('POST', '/customers', admin, { fullName: 'Dup', mobile, branchId: branch.id, customerType: 'INDIVIDUAL', status: 'ACTIVE' });
ok(r.status === 409, 'duplicate mobile warns');

r = await call('GET', `/slots/available?branchId=${branch.id}&date=${ymd(tomorrow)}`, null);
ok(r.status === 200 && r.json.data.length > 0, 'available slots');
const slot = r.json.data[0];

// Booking
r = await call('POST', '/bookings', admin, {
  bookingType: 'SERVICE', customerId: customer.id, addressId: customer.addresses[0].id, items: [{ serviceId: svc.id, quantity: 2 }],
  scheduledDate: ymd(tomorrow), slotId: slot.id, instructions: 'Call before arriving',
});
ok(r.status === 201 && /^LAS-\d{4}-\d{6}$/.test(r.json.data?.bookingNumber), `create booking ${r.json.data?.bookingNumber ?? JSON.stringify(r.json.error)}`);
const booking = r.json.data;
ok(booking.status === 'CONFIRMED', 'booking confirmed (pay-after-service policy)');

r = await call('POST', `/bookings/${booking.id}/status`, admin, { status: 'COMPLETED' });
ok(r.status === 422, 'invalid transition CONFIRMED→COMPLETED blocked');

r = await call('GET', `/bookings/${booking.id}/suggestions`, admin);
ok(r.status === 200 && r.json.data.length > 0, 'technician suggestions');
const tech = r.json.data[0];
r = await call('POST', `/bookings/${booking.id}/assign`, admin, { staffId: tech.staffId });
ok(r.status === 200 && r.json.data.status === 'ASSIGNED', 'assign technician');

// Technician flow
r = await call('POST', '/auth/login', null, { identifier: 'tech@demo.local', password: 'Demo@1234' });
const techTok = r.json.data.tokens.accessToken;
r = await call('GET', '/technician/jobs?scope=active', techTok);
ok(r.status === 200 && r.json.data.some((j) => j.id === booking.id), 'technician sees job');
for (const [path, body, expect] of [
  ['respond', { accept: true }, 'ACCEPTED'],
  ['status', { status: 'ON_THE_WAY' }, 'ON_THE_WAY'],
  ['status', { status: 'ARRIVED' }, 'ARRIVED'],
  ['status', { status: 'IN_PROGRESS' }, 'IN_PROGRESS'],
]) {
  r = await call('POST', `/technician/jobs/${booking.id}/${path}`, techTok, body);
  ok(r.status === 200 && r.json.data.status === expect, `tech → ${expect}`);
}
r = await call('POST', `/technician/jobs/${booking.id}/notes`, techTok, { note: 'Filters cleaned, gas pressure normal' });
ok(r.status === 201, 'tech note');
r = await call('POST', `/technician/jobs/${booking.id}/complete`, techTok, { note: 'Done' });
ok(r.status === 200 && r.json.data.status === 'COMPLETED', 'tech completes job');

// Customer app
r = await call('POST', '/auth/login', null, { identifier: 'customer@demo.local', password: 'Demo@1234' });
const custTok = r.json.data.tokens.accessToken;
r = await call('GET', `/me/bookings/${booking.id}`, custTok);
ok(r.status === 404, 'customer cannot see another customer booking');
r = await call('GET', '/me/home', custTok);
ok(r.status === 200, 'customer home');
r = await call('GET', '/me/addresses', custTok);
const custAddr = r.json.data[0];
r = await call('POST', '/me/bookings', custTok, { bookingType: 'REPAIR', addressId: custAddr.id, scheduledDate: ymd(tomorrow), problemDescription: 'AC not cooling properly', items: [] });
ok(r.status === 201, `customer repair booking ${r.json.error?.message ?? ''}`);
r = await call('GET', '/customers', custTok);
ok(r.status === 403, 'customer blocked from admin API');

// Invoice + GST
r = await call('POST', '/invoices/from-booking', admin, { bookingId: booking.id, applyGst: true, discount: 0 });
ok(r.status === 201, `invoice ${r.json.data?.invoiceNumber ?? JSON.stringify(r.json.error)}`);
const inv = r.json.data;
const base = Number(svc.effectivePrice) * 2;
ok(Number(inv.grandTotal) === Math.round(base * 1.18 * 100) / 100, `GST math ${inv.grandTotal} == ${base}*1.18`);
ok(Number(inv.cgst) + Number(inv.sgst) === Number(inv.gstTotal), 'CGST+SGST split');
r = await call('POST', '/invoices/from-booking', admin, { bookingId: booking.id, applyGst: true });
ok(r.status === 409, 'duplicate invoice blocked');

// Payment
r = await call('POST', '/payments', admin, { customerId: customer.id, invoiceId: inv.id, method: 'UPI_MANUAL', amount: 500, referenceNumber: `UPI${Date.now()}` });
ok(r.status === 201 && r.json.data.status === 'VERIFIED', 'record + auto-verify payment');
r = await call('POST', '/payments', admin, { customerId: customer.id, invoiceId: inv.id, method: 'CASH', amount: 999999 });
ok(r.status === 422, 'overpayment blocked');
r = await call('GET', `/customers/${customer.id}/ledger`, admin);
const expectedBal = Math.round((Number(inv.grandTotal) - 500) * 100) / 100;
ok(r.status === 200 && r.json.data.summary.balance === expectedBal, `ledger balance ${r.json.data?.summary?.balance} == ${expectedBal}`);

r = await fetch(`${BASE}/invoices/${inv.id}/pdf`, { headers: { Authorization: `Bearer ${admin}` } });
const pdf = Buffer.from(await r.arrayBuffer());
ok(r.status === 200 && pdf.subarray(0, 4).toString() === '%PDF', `invoice PDF (${pdf.length} bytes)`);

// AMC
r = await call('POST', '/amc', admin, {
  customerId: customer.id, addressId: customer.addresses[0].id, branchId: branch.id, productDetails: '2 x Split AC 1.5T',
  serviceIds: [svc.id], startDate: ymd(tomorrow), endDate: ymd(new Date(tomorrow.getTime() + 364 * 86400000)), totalVisits: 4, visitFrequencyMonths: 3, contractAmount: 3999, applyGst: true,
});
ok(r.status === 201, `AMC created ${r.json.data?.amcNumber ?? JSON.stringify(r.json.error)}`);
const amc = r.json.data;
r = await call('POST', `/amc/${amc.id}/invoice`, admin);
ok(r.status === 200 && r.json.data.status === 'PENDING_PAYMENT', 'AMC invoiced');
const amcInv = r.json.data.invoices[0];
r = await call('POST', '/payments', admin, { customerId: customer.id, invoiceId: amcInv.id, method: 'BANK_TRANSFER', amount: Number(amcInv.grandTotal), referenceNumber: `NEFT${Date.now()}` });
ok(r.status === 201, 'AMC paid');
r = await call('GET', `/amc/${amc.id}`, admin);
ok(r.json.data.status === 'ACTIVE' && r.json.data.visits.length === 4, `AMC active with ${r.json.data.visits.length} visits`);
r = await call('POST', `/amc/visits/${r.json.data.visits[0].id}/book`, admin, { scheduledDate: ymd(tomorrow), staffId: tech.staffId });
ok(r.status === 200 && r.json.data.status === 'BOOKED', `AMC visit booked ${r.json.error?.message ?? ''}`);

// Reports
for (const key of ['bookings', 'revenue', 'services', 'staff', 'gst']) {
  r = await call('GET', `/reports/${key}`, admin);
  ok(r.status === 200, `report ${key}`);
}
r = await fetch(`${BASE}/reports/revenue?format=xlsx`, { headers: { Authorization: `Bearer ${admin}` } });
ok(r.status === 200 && (r.headers.get('content-type') ?? '').includes('spreadsheet'), 'xlsx export');
r = await call('GET', `/search?q=${mobile.slice(0, 6)}`, admin);
ok(r.status === 200 && r.json.data.customers.length > 0, 'global search');
r = await call('GET', `/share/whatsapp?type=invoice&id=${inv.id}`, admin);
ok(r.status === 200 && r.json.data.url.startsWith('https://wa.me/91'), 'wa.me share link');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
