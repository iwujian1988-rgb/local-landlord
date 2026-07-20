// P0-3/P0-4 verification: mass-assignment attempts must be rejected.
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

  // Setup: landlord + property + room + tenant
  const code = `dev_massassign_${Date.now()}`;
  const wL = await http('/auth/wechat/login', { method:'POST', body:{ code } });
  const landT = u(wL).token;

  const pCreate = await http('/properties', { method:'POST', token: landT, body: { name: 'MassAssignTest' } });
  const pid = u(pCreate).id;

  // A second property owned by same landlord (to test cross-property attack)
  const p2Create = await http('/properties', { method:'POST', token: landT, body: { name: 'OtherProp' } });
  const pid2 = u(p2Create).id;

  const rCreate = await http(`/properties/${pid}/rooms`, {
    method:'POST', token: landT,
    body: { name: 'R1', rent: 3000, deposit: 3000 },
  });
  const rid = u(rCreate).id;

  const tCreate = await http(`/rooms/${rid}/tenant`, {
    method:'POST', token: landT,
    body: { name: 'T1', phone: '13900000000', moveInDate: '2026-06-01', rentDay: 10, payMonths: 1, deposit: 3000 },
  });
  const tid = u(tCreate) && u(tCreate).id;

  // ===== Test P0-3: room update with propertyId in body =====
  // Attempt to move room into pid2 — should be rejected by forbidNonWhitelisted.
  const attackRoom = await http(`/rooms/${rid}`, {
    method:'PUT', token: landT,
    body: { name: 'R1', propertyId: pid2 },
  });
  c('P0-3 room update rejects propertyId', attackRoom.status === 400, `status=${attackRoom.status}`);

  // Verify room still in original property
  const roomCheck = u(await http(`/rooms/${rid}`, { token: landT }));
  c('P0-3 room propertyId unchanged', roomCheck && Number(roomCheck.propertyId) === pid, `got=${roomCheck && roomCheck.propertyId} expected=${pid}`);

  // ===== Test P0-4: tenant update with status in body =====
  // UpdateTenantDto — need to read it first to know if status is allowed.
  // If allowed: landlord could flip status=0 to undo move-out without firing the move-out flow.
  const attackTenant = await http(`/tenants/${tid}`, {
    method:'PUT', token: landT,
    body: { status: 0 },  // attempt to flip to moved-out without proper flow
  });
  // Acceptable outcomes: 400 (forbidNonWhitelisted if DTO doesn't have status) OR
  // 200 (DTO has status — bad, mass assignment works). We want 400.
  const tenantAfter = u(await http(`/tenants/${tid}`, { token: landT }));
  c('P0-4 tenant update with status rejected', attackTenant.status === 400, `status=${attackTenant.status}`);

  // Verify tenant status unchanged
  c('P0-4 tenant status still=1', tenantAfter && Number(tenantAfter.status) === 1, `got=${tenantAfter && tenantAfter.status}`);

  // ===== cleanup =====
  if (tid) await http(`/tenants/${tid}`, { method:'DELETE', token: landT, body:{} }).catch(()=>{});
  if (rid) await http(`/rooms/${rid}`, { method:'DELETE', token: landT }).catch(()=>{});
  if (pid) await http(`/properties/${pid}`, { method:'DELETE', token: landT }).catch(()=>{});
  if (pid2) await http(`/properties/${pid2}`, { method:'DELETE', token: landT }).catch(()=>{});

  console.log(`\n===== mass-assign verify: ${pass} pass / ${fail} fail =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
