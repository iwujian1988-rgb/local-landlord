// P0-1 verification: X-WX-OPENID header must NOT authenticate when ALLOW_OPENID_HEADER is unset/false.
// Also verifies normal JWT login still works (no regression).
const BASE = `http://localhost:3000/api`;
async function http(p, { method='GET', headers={}, body }={}) {
  const h = { 'Content-Type':'application/json', ...headers };
  const o = { method, headers: h };
  if (body !== undefined) o.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${p}`, o);
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
}

(async () => {
  let pass = 0, fail = 0;
  const c = (label, cond, d) => { console.log(`${cond?'✓':'✗'} ${label}${d?' — '+d:''}`); cond?pass++:fail++; };

  // ===== Test 1: forged X-WX-OPENID header on protected endpoint should be rejected =====
  // /auth/me requires JwtAuthGuard. Attacker sends X-WX-OPENID of a known victim.
  const forged = await http('/auth/me', {
    headers: { 'X-WX-OPENID': 'oFakeAttackerOpenId' },
  });
  // Expected: 401 (header path disabled by default, falls back to JWT which is missing)
  c('forged openid header rejected on /auth/me', forged.status === 401, `status=${forged.status}`);

  // ===== Test 2: cloud-login with forged header should be rejected =====
  const cloudLogin = await http('/auth/cloud-login', {
    method: 'POST',
    headers: { 'X-WX-OPENID': 'oFakeAttackerOpenId' },
    body: {},
  });
  // Expected: 400 (cloud-login disabled by default)
  c('forged openid header rejected on /auth/cloud-login', cloudLogin.status === 400, `status=${cloudLogin.status} msg=${cloudLogin.data && cloudLogin.data.message}`);

  // ===== Test 3: normal JWT login still works (no regression) =====
  const wL = await http('/auth/wechat/login', {
    method: 'POST',
    body: { code: `dev_p0verify_${Date.now()}` },
  });
  const token = wL.data?.data?.token;
  c('JWT login still works', !!token, `token=${token?'present':'missing'}`);

  // ===== Test 4: JWT-authenticated request succeeds =====
  if (token) {
    const me = await http('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    c('JWT request succeeds', me.status === 200, `status=${me.status}`);
  }

  console.log(`\n===== P0-1 verify: ${pass} pass / ${fail} fail =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
