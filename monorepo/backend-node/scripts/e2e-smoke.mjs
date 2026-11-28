// End-to-end API test of the whole business flow.
// Requires: running API (npm run dev) on a seeded + demo database (npm run db:seed && npm run db:seed:demo).
// It creates records (customers, bookings, invoices, payments, stock, AMC): run it on a test database.
// Usage: API_URL=http://localhost:8000/api/v1 ADMIN_PASSWORD=... node scripts/e2e-smoke.mjs
const BASE = process.env.API_URL ?? 'http://localhost:8000/api/v1';
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) fails++;
};

async function call(method, path, token, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers, text };
}
const err = (r) => r.json?.error?.message ?? '';
const key = () => crypto.randomUUID();

const today = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const tomorrow = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1));
if (tomorrow.getUTCDay() === 0) tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

// ─── Auth ───
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
const rotated = r.json.data.refreshToken;
r = await call('POST', '/auth/refresh', null, { refreshToken: refresh });
ok(r.status === 401, 'reused refresh token rejected');
r = await call('POST', '/auth/refresh', null, { refreshToken: rotated });
ok(r.status === 200, 'session survives a parallel refresh (another tab)');
r = await call('POST', '/auth/admin/login', null, { identifier: 'manager', password: 'Demo@1234' });
const manager = r.json.data.tokens.accessToken;
r = await call('POST', '/auth/login', null, { identifier: 'tech@demo.local', password: 'Demo@1234' });
const techTok = r.json.data.tokens.accessToken;
r = await call('POST', '/auth/login', null, { identifier: 'customer@demo.local', password: 'Demo@1234' });
const custTok = r.json.data.tokens.accessToken;
ok(!!manager && !!techTok && !!custTok, 'manager, technician and customer logins');

r = await call('GET', '/dashboard', admin);
ok(r.status === 200 && r.json.data.kpis, 'dashboard');

// ─── Master data ───
r = await call('GET', '/services?pageSize=50', null);
ok(r.status === 200 && r.json.data.length === 36, `public services (${r.json.data?.length})`);
const svc = r.json.data.find((s) => s.code === 'AC-GEN-SVC');
const gas = r.json.data.find((s) => s.code === 'AC-GAS-REF');
r = await call('GET', '/branches', admin);
const branch = r.json.data.find((b) => b.code === 'IDR-01') ?? r.json.data[0];
r = await call('GET', '/states', null);
const mp = r.json.data.find((s) => s.code === 'MP');
r = await call('GET', `/cities?stateId=${mp.id}`, null);
const city = r.json.data[0];

r = await call('POST', '/stock-items', admin, { branchId: branch.id, code: `CAP${Date.now() % 100000}`, name: 'Capacitor 45 MFD', unit: 'PCS', hsnCode: '8532', salePrice: 450, gstRate: 18, quantity: 5, lowStockLevel: 1 });
ok(r.status === 201, `stock item ${err(r)}`);
const stockItem = r.json.data;

// ─── Customers ───
const mobile = '9' + String(Date.now()).slice(-9);
r = await call('POST', '/customers', admin, {
  fullName: 'Rahul Verma', mobile, branchId: branch.id, customerType: 'INDIVIDUAL', status: 'ACTIVE',
  address: { label: 'Home', line1: '45, MG Road, Near City Mall', stateId: mp.id, cityId: city.id },
});
ok(r.status === 201 && r.json.data.source === 'ADMIN', `customer without PIN code, source ${r.json.data?.source} ${err(r)}`);
const customer = r.json.data;
r = await call('POST', '/customers', admin, { fullName: 'Dup', mobile, branchId: branch.id, customerType: 'INDIVIDUAL', status: 'ACTIVE' });
ok(r.status === 409, 'duplicate mobile warns');
r = await call('GET', '/customers?search=9000000005', admin);
const demo = r.json.data[0];
ok(!!demo, 'demo app customer found');

// ─── Booking + assign ───
r = await call('GET', `/slots/available?branchId=${branch.id}&date=${ymd(tomorrow)}`, null);
ok(r.status === 200 && r.json.data.length > 0, 'available slots');
const slot = r.json.data[0];
r = await call('POST', '/bookings', admin, {
  bookingType: 'SERVICE', customerId: demo.id, addressId: demo.addresses[0].id, items: [{ serviceId: svc.id, quantity: 2 }],
  scheduledDate: ymd(tomorrow), slotId: slot.id, instructions: 'Call before arriving',
});
ok(r.status === 201 && /^LAS-\d{4}-\d{6}$/.test(r.json.data?.bookingNumber), `create booking ${r.json.data?.bookingNumber ?? err(r)}`);
const booking = r.json.data;
ok(booking.status === 'CONFIRMED' && booking.source === 'ADMIN', 'booking confirmed, manual');
r = await call('POST', `/bookings/${booking.id}/status`, admin, { status: 'COMPLETED' });
ok(r.status === 422, 'invalid transition CONFIRMED→COMPLETED blocked');
r = await call('GET', `/bookings/${booking.id}/suggestions`, admin);
ok(r.status === 200 && r.json.data.length > 0, 'technician suggestions');
const tech = r.json.data[0];
r = await call('POST', `/bookings/${booking.id}/assign`, admin, { staffId: tech.staffId, scheduledDate: ymd(tomorrow), scheduledTime: '10:30' });
ok(r.status === 200 && r.json.data.status === 'ASSIGNED' && r.json.data.scheduledTime === '10:30' && r.json.data.slotId === null, 'assign with manual date and time');

// ─── Technician field flow ───
r = await call('GET', '/technician/jobs?scope=active', techTok);
ok(r.status === 200 && r.json.data.some((j) => j.id === booking.id), 'technician sees job');
const job = `/technician/jobs/${booking.id}`;
r = await call('POST', `${job}/extra-work`, techTok, { items: [{ serviceId: gas.id, quantity: 1 }] });
ok(r.status === 422, 'extra work blocked before arriving');
for (const [path, body, expect] of [
  ['respond', { accept: true }, 'ACCEPTED'],
  ['status', { status: 'ON_THE_WAY' }, 'ON_THE_WAY'],
  ['status', { status: 'ARRIVED' }, 'ARRIVED'],
  ['status', { status: 'IN_PROGRESS' }, 'IN_PROGRESS'],
]) {
  r = await call('POST', `${job}/${path}`, techTok, body);
  const seen = await call('GET', `/bookings/${booking.id}`, admin);
  ok(r.status === 200 && seen.json.data.status === expect, `tech → ${expect}, admin sees ${seen.json.data.status}`);
}
r = await call('POST', `${job}/notes`, techTok, { note: 'Filters cleaned, gas pressure normal' });
ok(r.status === 201, 'tech note');
r = await call('POST', `${job}/extra-work`, techTok, { items: [{ serviceId: gas.id, quantity: 1 }], note: 'Gas was low' });
ok(r.status === 200 && r.json.data.items.some((i) => i.isExtra && i.serviceId === gas.id), 'extra work added to the job');
r = await call('POST', `${job}/findings`, techTok, { finding: 'PCB weak, customer declined replacement', followUpMonths: 3 });
ok(r.status === 200 && r.json.data.notes.some((n) => n.kind === 'FINDING'), 'finding recorded');
r = await call('GET', `${job}/payment`, techTok);
ok(r.status === 200 && r.json.data.canCollect && Number.isInteger(r.json.data.amountDue), `amount to collect ₹${r.json.data?.amountDue} (rounded)`);
const collectAmount = r.json.data.amountDue;
r = await call('POST', `${job}/payment`, techTok, { method: 'CASH' }, { 'Idempotency-Key': key() });
ok(r.status === 201 && r.json.data.status === 'PENDING_VERIFICATION' && !!r.json.data.receivedBy, `technician collects cash (pending, by ${r.json.data?.receivedBy})`);
const techPayment = r.json.data;
r = await call('POST', `${job}/complete`, techTok, { note: 'Done' });
ok(r.status === 200 && r.json.data.status === 'COMPLETED', 'tech completes job');

// ─── For Invoice: draft → edit → approve ───
r = await call('GET', '/draft-invoices', admin);
const draft = r.json.data?.find((d) => d.bookingId === booking.id);
ok(r.status === 200 && draft?.status === 'DRAFT', `bill waiting in For Invoice (${draft?.invoiceNumber})`);
ok(Number.isInteger(Number(draft?.grandTotal)) && Number(draft.grandTotal) === collectAmount, `draft total ₹${draft?.grandTotal} rounded up, equals collected ₹${collectAmount}`);
r = await call('GET', `/invoices?search=${booking.bookingNumber}`, admin);
ok(r.json.data.length === 0, 'draft not in Invoices');
r = await call('GET', '/me/invoices', custTok);
ok(!r.json.data.some((i) => i.id === draft.id), 'customer does not see the draft');
r = await call('POST', '/draft-invoices', admin, { bookingId: booking.id });
ok(r.status === 409, 'second bill for the booking blocked');
r = await call('POST', '/payments', admin, { customerId: demo.id, invoiceId: draft.id, method: 'CASH', amount: 1, receivedBy: 'Office' });
ok(r.status === 422, 'draft cannot be paid');
r = await call('GET', `/draft-invoices/${draft.id}`, admin);
const lines = r.json.data.items.map((i) => ({ serviceId: i.serviceId, description: i.description, quantity: i.quantity, rate: Number(i.rate), gstRate: 0, discount: 0 }));
r = await call('PATCH', `/draft-invoices/${draft.id}`, admin, { lines, applyGst: false, isInterState: false, discount: 0, isFreeService: false, notes: 'GST not charged' });
ok(r.status === 200 && Number(r.json.data.gstTotal) === 0, `GST removed in For Invoice (₹${r.json.data?.grandTotal})`);
const edited = r.json.data;
r = await call('POST', `/draft-invoices/${draft.id}/approve`, admin);
ok(r.status === 200 && /^INV-/.test(r.json.data.invoiceNumber) && r.json.data.status === 'ISSUED', `approved as ${r.json.data?.invoiceNumber}`);
const inv = r.json.data;
ok(Number(inv.grandTotal) === Number(edited.grandTotal), 'approved total = edited total');
r = await call('GET', `/invoices?gst=NON_GST&search=${booking.bookingNumber}`, admin);
ok(r.json.data.some((i) => i.id === inv.id), 'non-GST filter finds it');

// ─── Payment verification ───
r = await call('POST', `/payments/${techPayment.id}/verify`, admin, { approve: true });
ok(r.status === 200 && r.json.data.status === 'VERIFIED' && r.json.data.receivingAccount === 'Cash in hand', `technician cash verified → ${r.json.data?.receivingAccount} ${err(r)}`);
r = await call('GET', `/invoices/${inv.id}`, admin);
ok(r.json.data.status === 'PAID' && Number(r.json.data.balanceDue) === 0, 'invoice paid (extra collected stays as customer credit)');
r = await call('GET', '/me/invoices', custTok);
ok(r.json.data.find((i) => i.id === inv.id)?.status === 'PAID', 'customer sees Paid');

// ─── Manual invoice with stock, receive payment ───
r = await call('POST', '/invoices', admin, {
  customerId: customer.id, branchId: branch.id, applyGst: true, isInterState: false, discount: 0, isFreeService: false,
  lines: [{ stockItemId: stockItem.id, description: stockItem.name, quantity: 2, rate: 450, gstRate: 18, discount: 0 }],
});
ok(r.status === 201 && Number(r.json.data.grandTotal) === 1062, `manual invoice with stock ₹${r.json.data?.grandTotal} ${err(r)}`);
const manualInv = r.json.data;
r = await call('GET', `/stock-items?branchId=${branch.id}`, admin);
ok(r.json.data.find((s) => s.id === stockItem.id)?.quantity === 3, 'stock reduced 5 → 3');
r = await call('POST', '/payments', admin, { customerId: customer.id, invoiceId: manualInv.id, method: 'CASH', amount: 500 }, { 'Idempotency-Key': key() });
ok(r.status === 422, '"Received by" is required');
r = await call('POST', '/payments', admin, { customerId: customer.id, invoiceId: manualInv.id, method: 'CASH', amount: 999999, receivedBy: 'Office' }, { 'Idempotency-Key': key() });
ok(r.status === 422, 'overpayment blocked');
r = await call('POST', '/payments', admin, { customerId: customer.id, invoiceId: manualInv.id, method: 'UPI_MANUAL', amount: 500, receivedBy: 'Office', referenceNumber: `UPI${Date.now()}` }, { 'Idempotency-Key': key() });
ok(r.status === 201 && r.json.data.status === 'PENDING_VERIFICATION', 'received payment waits for verification');
r = await call('POST', `/payments/${r.json.data.id}/verify`, admin, { approve: true });
ok(r.status === 200 && r.json.data.status === 'VERIFIED', 'office verifies payment');
r = await call('GET', `/customers/${customer.id}/ledger`, admin);
ok(r.status === 200 && r.json.data.summary.balance === 562, `ledger balance ${r.json.data?.summary?.balance} == 562`);
r = await fetch(`${BASE}/invoices/${manualInv.id}/pdf`, { headers: { Authorization: `Bearer ${admin}` } });
const pdf = Buffer.from(await r.arrayBuffer());
ok(r.status === 200 && pdf.subarray(0, 4).toString() === '%PDF', `invoice PDF (${pdf.length} bytes)`);

// ─── Customer app booking + cancellation ───
r = await call('GET', '/me/addresses', custTok);
r = await call('POST', '/me/bookings', custTok, { bookingType: 'REPAIR', addressId: r.json.data[0].id, scheduledDate: ymd(tomorrow), problemDescription: 'AC not cooling properly', items: [] });
ok(r.status === 201 && r.json.data.source === 'CUSTOMER_APP', `customer app booking ${err(r)}`);
const appBooking = r.json.data;
r = await call('GET', `/me/bookings/${booking.id + 100000}`, custTok);
ok(r.status === 404, 'customer cannot see other bookings');
r = await call('GET', '/customers', custTok);
ok(r.status === 403, 'customer blocked from admin API');
r = await call('POST', `/bookings/${appBooking.id}/cancel`, admin, { reason: 'Customer travelling' });
ok(r.status === 200, 'cancel with reason');
r = await call('GET', `/reports/cancellations?from=${ymd(new Date(Date.now() - 86400000))}&to=${ymd(tomorrow)}`, admin);
ok(r.json.data.rows.some((x) => x.bookingNumber === appBooking.bookingNumber && x.reason === 'Customer travelling'), 'cancelled bookings report');

// ─── AMC ───
r = await call('POST', '/amc', admin, {
  customerId: customer.id, addressId: customer.addresses[0].id, branchId: branch.id, productDetails: '2 x Split AC 1.5T',
  serviceIds: [svc.id], startDate: ymd(tomorrow), endDate: ymd(new Date(tomorrow.getTime() + 364 * 86400000)), totalVisits: 4, visitFrequencyMonths: 3, contractAmount: 3999, applyGst: true,
});
ok(r.status === 201, `AMC created ${r.json.data?.amcNumber ?? err(r)}`);
const amc = r.json.data;
r = await call('POST', `/amc/${amc.id}/invoice`, admin);
ok(r.status === 200 && r.json.data.status === 'PENDING_PAYMENT', 'AMC invoiced');
const amcInv = r.json.data.invoices[0];
ok(Number.isInteger(Number(amcInv.grandTotal)), `AMC invoice rounded ₹${amcInv.grandTotal}`);
r = await call('POST', '/payments', admin, { customerId: customer.id, invoiceId: amcInv.id, method: 'BANK_TRANSFER', amount: Number(amcInv.grandTotal), receivedBy: 'Office', referenceNumber: `NEFT${Date.now()}` }, { 'Idempotency-Key': key() });
ok(r.status === 201, 'AMC payment received');
r = await call('POST', `/payments/${r.json.data.id}/verify`, admin, { approve: true });
r = await call('GET', `/amc/${amc.id}`, admin);
ok(r.json.data.status === 'ACTIVE' && r.json.data.visits.length === 4, `AMC active with ${r.json.data.visits.length} visits after verification`);
r = await call('POST', `/amc/visits/${r.json.data.visits[0].id}/book`, admin, { scheduledDate: ymd(tomorrow), staffId: tech.staffId });
ok(r.status === 200 && r.json.data.status === 'BOOKED', `AMC visit booked ${err(r)}`);
r = await call('GET', `/invoices/${amcInv.id}`, admin);
ok(r.json.data.amcUsage?.totalVisits === 4, 'AMC usage on the bill');

// ─── Reports, search, sharing ───
for (const k of ['bookings', 'cancellations', 'revenue', 'services', 'staff', 'branches', 'customers', 'gst', 'payments', 'amc']) {
  r = await call('GET', `/reports/${k}`, admin);
  ok(r.status === 200, `report ${k}`);
}
r = await call('GET', '/reports/payments', admin);
ok(r.json.data.rows.some((x) => x.account === 'Cash in hand'), 'payment report shows Cash in hand');
r = await fetch(`${BASE}/reports/revenue?format=xlsx`, { headers: { Authorization: `Bearer ${admin}` } });
ok(r.status === 200 && (r.headers.get('content-type') ?? '').includes('spreadsheet'), 'xlsx export');
r = await call('GET', `/search?q=${mobile.slice(0, 6)}`, admin);
ok(r.status === 200 && r.json.data.customers.length > 0, 'global search');
r = await call('GET', `/share/whatsapp?type=invoice&id=${inv.id}`, admin);
ok(r.status === 200 && r.json.data.url.startsWith('https://wa.me/91'), 'wa.me share link');

// ─── Staff & permissions ───
r = await call('GET', '/staff?pageSize=50', admin);
const techStaff = r.json.data.find((s) => s.user.username === 'tech');
r = await call('PATCH', `/staff/${techStaff.id}`, admin, { status: 'SUSPENDED' });
ok(r.status === 422, 'suspension needs a reason');
r = await call('PATCH', `/staff/${techStaff.id}`, admin, { roleCodes: ['TECHNICIAN', 'SUPER_ADMIN'] });
ok(r.status === 403, 'Super Admin not assignable from staff');
r = await call('DELETE', `/staff/${techStaff.id}`, admin);
ok(r.status === 404, 'staff cannot be deleted');
r = await call('GET', '/draft-invoices', manager);
ok(r.status === 200, 'branch manager can open For Invoice');
r = await call('GET', '/draft-invoices', techTok);
ok(r.status === 403, 'technician cannot open For Invoice');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
