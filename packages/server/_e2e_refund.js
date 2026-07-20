// P1-B verify: prepaid refund must account for both
//   (a) mid-month move-in overpaid days, AND
//   (b) early move-out unused tail days.
// Setup: 4/15 move-in, payMonths=3, rent=3000, monthly/30=100/day.
//   First bill covers [2026-04..2026-06] = full 3 months charged.
// Move-out on 6/15:
//   overpaidBeforeMoveIn = 14 (4/1 → 4/15)
//   unusedAfterMoveOut   = 15 (6/15 → 6/30)
//   total                = 29 days
//   refund               = 29 × 100 = 2900
const BASE = `http://localhost:3000/api`;
async function http(p, { method='GET', token, body }={}) {
  const h = { 'Content-Type':'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  const o = { method, headers: h };
  if (body !== undefined) o.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${p}`, o);
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
};
const u = (r) => (r.data && typeof r.data === 'object' && 'data' in r.data) ? r.data.data : r.data;

(async () => {
  let pass = 0, fail = 0;
  const c = (label, cond, d) => { console.log(`${cond?'✓':'✗'} ${label}${d?' — '+d:''}`); cond?pass++:fail++; };

  const wL = await http('/auth/wechat/login', { method:'POST', body:{ code: `dev_p1b_${Date.now()}` } });
  const landT = u(wL).token;

  const pCreate = await http('/properties', { method:'POST', token: landT, body: { name: 'RefundTest' } });
  const pid = u(pCreate).id;
  const rCreate = await http(`/properties/${pid}/rooms`, {
    method:'POST', token: landT,
    body: { name: 'R1', rent: 3000, deposit: 3000 },
  });
  const rid = u(rCreate).id;

  await http(`/rooms/${rid}/fee-items`, {
    method:'POST', token: landT,
    body: { fees: [{ name: '房租', amount: 3000, type: 'fixed', enabled: true, isRent: true }] },
  });

  // Tenant: 4/15 move-in, payMonths=3
  const tCreate = await http(`/rooms/${rid}/tenant`, {
    method:'POST', token: landT,
    body: {
      name: 'T1', phone: '13900000000',
      moveInDate: '2026-04-15',
      rentDay: 15,
      payMonths: 3,
      deposit: 3000,
    },
  });
  const tid = u(tCreate) && u(tCreate).id;
  c('tenant created', !!tid);

  // Pay the first bill (mark as paid so computePrepaidRefund can find it)
  const bills = u(await http(`/rooms/${rid}/bills`, { token: landT }));
  const billId = bills && bills.billId;
  const pay = await http(`/bills/${billId}/confirm`, { method:'PUT', token: landT, body: {} });
  c('first bill paid', pay.status === 200);

  // Move out on 6/15 — expected refund = (14 + 15) × 100 = 2900
  const moveOut = await http(`/tenants/${tid}`, {
    method:'DELETE', token: landT,
    body: { moveOutDate: '2026-06-15', depositStatus: 0 },
  });
  c('move-out returned 200', moveOut.status === 200, `status=${moveOut.status} body=${JSON.stringify(moveOut.data).slice(0,200)}`);

  const tenant = u(moveOut) || moveOut.data;
  const refund = Number(tenant?.prepaidRefundAmount);
  // Allow ±0.5 for rounding
  const expected = 2900;
  const close = Math.abs(refund - expected) < 1;
  c(`refund = ${expected} (14 overpaid + 15 unused = 29 days × 100)`, close, `got=${refund}`);

  // Cleanup
  if (tid) await http(`/tenants/${tid}`, { method:'DELETE', token: landT, body:{} }).catch(()=>{});
  if (rid) await http(`/rooms/${rid}`, { method:'DELETE', token: landT }).catch(()=>{});
  if (pid) await http(`/properties/${pid}`, { method:'DELETE', token: landT }).catch(()=>{});

  console.log(`\n===== P1-B verify: ${pass} pass / ${fail} fail =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
