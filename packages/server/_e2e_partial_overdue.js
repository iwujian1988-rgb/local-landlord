// P0-6 verify: status=3 (partial) bills must also be marked overdue by markOverdueBills cron.
// Setup: tenant with payMonths=3, rentDay=5 (so dueDay=5, today=17 means past due).
// 1. Auto first bill (status=0) covering 2026-04..2026-06.
// 2. Partial pay 100 of 9000 → status flips to 3.
// 3. Run trigger-mark-overdue.
// 4. Verify status is now 2 (overdue) — previously stuck at 3 forever.
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

  // ===== admin login =====
  const adminLogin = await http('/auth/admin/login', {
    method:'POST', body: { username: 'admin', password: 'admin123' },
  });
  const adminT = u(adminLogin) && u(adminLogin).token;
  c('admin login', !!adminT);

  // ===== landlord setup =====
  const wL = await http('/auth/wechat/login', { method:'POST', body:{ code: `dev_p06_${Date.now()}` } });
  const landT = u(wL).token;

  const pCreate = await http('/properties', { method:'POST', token: landT, body: { name: 'OverduePartialTest' } });
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

  // Tenant: moveIn 2 months ago, payMonths=3, rentDay=5 (today is 17 so past due)
  const today = new Date();
  const moveIn = new Date(today.getFullYear(), today.getMonth() - 2, 15);
  const tCreate = await http(`/rooms/${rid}/tenant`, {
    method:'POST', token: landT,
    body: {
      name: 'T1', phone: '13900000000',
      moveInDate: moveIn.toISOString().slice(0, 10),
      rentDay: 5,  // past due (today is 17)
      payMonths: 3,
      deposit: 3000,
    },
  });
  const tid = u(tCreate) && u(tCreate).id;
  c('tenant created', !!tid);

  // Get the first bill (period=2026-04, periodEnd=2026-06)
  const bills = u(await http(`/rooms/${rid}/bills`, { token: landT }));
  const billId = bills && bills.billId;
  c('first bill exists', !!billId, `billId=${billId} period=${bills && bills.period}..${bills && bills.periodEnd}`);

  // Partial pay 100 (of 9000)
  const partial = await http(`/bills/${billId}/confirm`, {
    method:'PUT', token: landT,
    body: { actualAmount: 100 },
  });
  c('partial payment accepted', partial.status === 200, `status=${partial.status}`);

  // Verify status is now 3 (partial)
  const billAfterPartial = u(await http(`/bills/${billId}`, { token: landT }));
  c('bill is partial (status=3)', billAfterPartial && Number(billAfterPartial.status) === 3, `status=${billAfterPartial && billAfterPartial.status}`);

  // Trigger mark-overdue (admin only)
  const trigger = await http('/subscription/trigger-mark-overdue', { method:'POST', token: adminT });
  const trigData = u(trigger);
  c('trigger-mark-overdue marked >=1', trigData && Number(trigData.marked) >= 1, `marked=${trigData && trigData.marked}`);

  // Verify bill is now overdue (status=2)
  const billAfterOverdue = u(await http(`/bills/${billId}`, { token: landT }));
  c('partial bill flipped to overdue (status=2)', billAfterOverdue && Number(billAfterOverdue.status) === 2, `status=${billAfterOverdue && billAfterOverdue.status}`);

  // Cleanup
  if (tid) await http(`/tenants/${tid}`, { method:'DELETE', token: landT, body:{} }).catch(()=>{});
  if (rid) await http(`/rooms/${rid}`, { method:'DELETE', token: landT }).catch(()=>{});
  if (pid) await http(`/properties/${pid}`, { method:'DELETE', token: landT }).catch(()=>{});

  console.log(`\n===== P0-6 verify: ${pass} pass / ${fail} fail =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
