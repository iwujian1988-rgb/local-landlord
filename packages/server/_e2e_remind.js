// End-to-end reminder/billing flow test
// Tests the full landlord workflow + cron triggers + field matching for miniapp
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
}
const u = (r) => (r.data && typeof r.data === 'object' && 'data' in r.data) ? r.data.data : r.data;
const jwtSub = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString('utf8')).sub; } catch { return null; } };

(async () => {
  let pass = 0, fail = 0, warns = 0;
  const c = (label, cond, d) => { console.log(`${cond?'✓':'✗'} ${label}${d?' — '+d:''}`); cond?pass++:fail++; };
  const w = (label, d) => { console.log(`⚠ ${label}${d?' — '+d:''}`); warns++; };

  // admin login
  const aL = await http('/auth/admin/login', { method:'POST', body:{username:'admin',password:'admin123'} });
  const adminT = u(aL).token;
  c('admin login', !!adminT);

  // create fresh landlord via dev backdoor
  const code = `dev_e2e_${Date.now()}`;
  const wL = await http('/auth/wechat/login', { method:'POST', body:{ code } });
  const landT = u(wL).token;
  const lid = jwtSub(landT);
  c('landlord dev login', !!landT && !!lid, `id=${lid}`);

  // get landlord's profile so we know openId (for reminder delivery)
  const prof = await http('/auth/me', { token: landT });
  console.log('  landlord profile:', JSON.stringify(u(prof)).slice(0,150));

  // ===== Step 1: landlord creates property =====
  console.log('\n--- step 1: property ---');
  const pCreate = await http('/properties', { method:'POST', token: landT, body: { name: 'E2E-Prop', address: 'e2e addr' } });
  const pid = u(pCreate) && u(pCreate).id;
  c('landlord create property', !!pid, `id=${pid} status=${pCreate.status}`);

  // landlord GET /properties should show it
  const pList = await http('/properties', { token: landT });
  c('landlord GET /properties shows new one', (u(pList)||[]).some(p => p.id === pid));

  // ===== Step 2: landlord creates room (POST /properties/:propertyId/rooms) =====
  console.log('\n--- step 2: room ---');
  const today = new Date();
  const todayDate = today.getDate(); // 17 if today is 2026-06-17
  const rCreate = await http(`/properties/${pid}/rooms`, { method:'POST', token: landT, body: { name: 'E2E-Room-101', rent: 2500, deposit: 5000 } });
  const rid = u(rCreate) && u(rCreate).id;
  c('landlord create room', !!rid, `id=${rid} status=${rCreate.status}`);

  // miniapp add-room-info flow: PUT /rooms/:id to update
  const rUpd = await http(`/rooms/${rid}`, { method:'PUT', token: landT, body: { name: 'E2E-Room-101-Updated', area: '20平米', floor: '3' } });
  c('landlord update room', rUpd.status === 200 || rUpd.status === 201, `status=${rUpd.status}`);

  // ===== Step 3: landlord sets up fee items =====
  console.log('\n--- step 3: fee items ---');
  const feeSet = await http(`/rooms/${rid}/fee-items`, {
    method:'POST', token: landT,
    body: { fees: [
      // API contract: type must be string 'fixed' or 'manual' (miniapp/src/pages/fee-setup).
      // Sending 0/1 silently degrades to 'manual' (numeric falls through the equality check).
      { name: '房租', amount: 2500, type: 'fixed', enabled: true },
      { name: '水费', amount: 0, type: 'manual', enabled: true },
    ]},
  });
  c('landlord set fee items', feeSet.status === 200 || feeSet.status === 201, `status=${feeSet.status} body=${JSON.stringify(feeSet.data).slice(0,100)}`);

  // ===== Step 4: landlord creates tenant with rentDay=today =====
  console.log('\n--- step 4: tenant ---');
  const tCreate = await http(`/rooms/${rid}/tenant`, {
    method:'POST', token: landT,
    body: {
      name: 'E2E-Tenant', phone: '13900000999',
      moveInDate: '2026-06-01',
      rentDay: todayDate, // today, so auto-bill should fire
      payMonths: 1,
      deposit: 5000,
    },
  });
  const tid = u(tCreate) && u(tCreate).id;
  c('landlord create tenant', !!tid, `id=${tid} status=${tCreate.status} msg=${tCreate.data && tCreate.data.message}`);

  // ===== Step 5: verify first bill was auto-created by create tenant =====
  console.log('\n--- step 5: first bill (created at tenant creation) ---');
  // /rooms/:roomId/bills returns a single current-period bill object, not a list
  const bill0 = u(await http(`/rooms/${rid}/bills`, { token: landT }));
  const firstBill = bill0 && bill0.billId ? { id: bill0.billId, period: bill0.period, items: bill0.billItems, totalAmount: bill0.billItems && bill0.billItems.reduce((s,i)=>s+Number(i.amount||0),0) } : null;
  c('tenant creation auto-creates first bill', !!firstBill, `billId=${firstBill && firstBill.id} period=${firstBill && firstBill.period}`);

  // ===== Step 6: admin triggers auto-bills (should be idempotent) =====
  console.log('\n--- step 6: trigger auto-bills ---');
  const trigger1 = await http('/subscription/trigger-auto-bills', { method:'POST', token: adminT });
  console.log('  trigger-auto-bills response:', JSON.stringify(trigger1.data));
  // after trigger, the same bill should still exist (no duplicate)
  const bill0b = u(await http(`/rooms/${rid}/bills`, { token: landT }));
  c('trigger-auto-bills is idempotent (same billId)', !bill0b || !bill0b.billId || bill0b.billId === (firstBill && firstBill.id), `before=${firstBill && firstBill.id} after=${bill0b && bill0b.billId}`);

  // B15: response should report actual generated count, not -1
  const reported = u(trigger1) && u(trigger1).generated;
  c('B15 trigger-auto-bills returns real count (not -1)', reported !== undefined && reported !== -1, `reported=${reported}`);

  // ===== Step 7: landlord sends the bill =====
  console.log('\n--- step 7: send bill ---');
  if (firstBill) {
    const send = await http(`/bills/${firstBill.id}/send`, {
      method:'PUT', token: landT,
      body: { items: firstBill.items || [] },
    });
    c('landlord send bill', send.status === 200 || send.status === 201, `status=${send.status}`);

    // ===== Step 8: landlord confirms payment =====
    const confirm = await http(`/bills/${firstBill.id}/confirm`, {
      method:'PUT', token: landT,
      body: { actualAmount: firstBill.totalAmount },
    });
    c('landlord confirm bill', confirm.status === 200 || confirm.status === 201, `status=${confirm.status}`);

    // verify bill is paid (status=1) — fetch by billId directly
    const bAfter = await http(`/bills/${firstBill.id}`, { token: landT });
    const updated = u(bAfter);
    c('bill status is now PAID (1)', updated && updated.status === 1, `status=${updated && updated.status}`);
  }

  // ===== Step 9: admin triggers other crons (smoke) + mark-overdue behavior =====
  console.log('\n--- step 9: other cron triggers (smoke) + mark-overdue ---');
  for (const ep of ['trigger-rent','trigger-overdue','trigger-move-out','trigger-contract-expiry','trigger-vacancy','trigger-monthly-summary']) {
    const r = await http(`/subscription/${ep}`, { method:'POST', token: adminT });
    c(`${ep} returns 2xx`, r.status === 200 || r.status === 201, `status=${r.status}`);
  }
  // mark-overdue should report an actual count (not -1, not undefined)
  const markOverdue1 = await http('/subscription/trigger-mark-overdue', { method:'POST', token: adminT });
  const markedCount = u(markOverdue1) && u(markOverdue1).marked;
  c('trigger-mark-overdue returns real count', typeof markedCount === 'number' && markedCount >= 0, `marked=${markedCount}`);
  // run it again — should be idempotent (already-overdue bills don't get re-marked)
  const markOverdue2 = await http('/subscription/trigger-mark-overdue', { method:'POST', token: adminT });
  const markedCount2 = u(markOverdue2) && u(markOverdue2).marked;
  c('trigger-mark-overdue idempotent on 2nd run', markedCount2 === 0, `2nd-run-marked=${markedCount2}`);

  // ===== Step 10: landlord stats endpoints (miniapp home) =====
  console.log('\n--- step 10: landlord read endpoints (miniapp consumption) ---');
  // ===== Step 10: landlord read endpoints that miniapp ACTUALLY consumes =====
  console.log('\n--- step 10: landlord read endpoints (miniapp consumption) ---');
  const endpoints = [
    '/stats/home',
    '/stats/rent',
    '/properties',
    '/rooms',
  ];
  for (const ep of endpoints) {
    const r = await http(ep, { token: landT });
    const ok = r.status === 200 || r.status === 201;
    if (ok) {
      c(`GET ${ep}`, true, `status=${r.status}`);
    } else {
      c(`GET ${ep}`, false, `status=${r.status} msg=${r.data && r.data.message}`);
    }
  }

  // ===== Step 11: verify field shapes that miniapp pages depend on =====
  console.log('\n--- step 11: field shape checks ---');
  const home = u(await http('/stats/home', { token: landT }));
  console.log('  /stats/home keys:', home ? Object.keys(home).join(',') : 'null');

  // miniapp /home/index.tsx reads statsRes — verify it actually contains the keys the page destructures.
  // Reading from packages/miniapp/src/pages/home/index.tsx, the page consumes whatever shape comes back,
  // so just verify the response isn't an error envelope and has at least greeting/profileName.
  const expectedHomeFields = ['greeting', 'profileName'];
  if (home) {
    const missing = expectedHomeFields.filter(k => !(k in home));
    if (missing.length > 0) {
      c('/stats/home has core fields', false, `missing=${missing.join(',')}`);
    } else {
      c('/stats/home has core fields', true);
    }
  }

  // ===== Step 12: admin tries to toggle enableAutoRemind=false then trigger =====
  console.log('\n--- step 12: enableAutoRemind toggle behavior (B16) ---');
  const paramsBefore = u(await http('/admin/settings/params', { token: adminT }));
  console.log('  current params:', JSON.stringify(paramsBefore));
  if (paramsBefore) {
    // disable
    await http('/admin/settings/params', { method:'PUT', token: adminT, body: { ...paramsBefore, enableAutoRemind: false } });
    // Cron jobs read this flag at start and skip. Manual trigger-* calls are admin-overridable
    // (admin explicitly hit the button), so we can't observe the skip via trigger-*.
    // But we CAN read the params back to verify persistence + shape.
    const paramsAfter = u(await http('/admin/settings/params', { token: adminT }));
    c('enableAutoRemind=false persists in system_params', paramsAfter && paramsAfter.enableAutoRemind === false, `value=${paramsAfter && paramsAfter.enableAutoRemind}`);
    // restore
    await http('/admin/settings/params', { method:'PUT', token: adminT, body: paramsBefore });
  }

  // ===== Cleanup =====
  console.log('\n--- cleanup ---');
  // move out tenant, delete room, delete property, disable landlord
  if (tid) await http(`/tenants/${tid}`, { method:'DELETE', token: landT, body: {} }).catch(()=>{});
  if (rid) await http(`/rooms/${rid}`, { method:'DELETE', token: landT }).catch(()=>{});
  if (pid) await http(`/properties/${pid}`, { method:'DELETE', token: landT }).catch(()=>{});
  await http(`/admin/landlords/${lid}/status`, { method:'PUT', token: adminT, body:{status:0} }).catch(()=>{});
  console.log('  done');

  console.log(`\n===== E2E RESULT: ${pass} pass / ${fail} fail / ${warns} warns =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
