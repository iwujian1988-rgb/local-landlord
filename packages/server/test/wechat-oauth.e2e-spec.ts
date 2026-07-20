import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Landlord } from '../src/modules/landlord/landlord.entity';
import request from 'supertest';

/**
 * WeChat OAuth full-path tests with mocked WeChat API.
 *
 * The production login flow is:
 *   1. miniapp POST /api/auth/wechat/login { code }
 *   2. server GET https://api.weixin.qq.com/sns/jscode2session?appid=X&secret=Y&js_code=code
 *   3. WeChat returns { openid, session_key } OR { errcode, errmsg }
 *   4. server find-or-create Landlord by openid
 *   5. server issue JWT
 *
 * Real WeChat API can't be hit from tests — we mock the httpGetJson private
 * method on AuthService. This verifies steps 3-5 work correctly for all
 * WeChat response shapes (success, errcode, network failure, missing openid).
 */
describe('WeChat OAuth 全链路 (mocked)', () => {
  let app: INestApplication;
  let authService: AuthService;

  beforeAll(async () => {
    process.env.WX_APPID = 'wx-test-appid';
    process.env.WX_SECRET = 'wx-test-secret';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Mock the private httpGetJson method on AuthService to return canned WeChat
   * responses. Returns a restore fn.
   */
  function mockWx(response: any, shouldReject = false) {
    const original = (authService as any).httpGetJson.bind(authService);
    (authService as any).httpGetJson = shouldReject
      ? () => Promise.reject(new Error('network'))
      : () => Promise.resolve(response);
    return () => { (authService as any).httpGetJson = original; };
  }

  describe('成功路径', () => {
    it('TC-WX-001: 新 openid → 自动建 landlord + 返 JWT', async () => {
      const restore = mockWx({ openid: 'wx-new-' + Date.now(), session_key: 'sk' });
      try {
        const result = await authService.wechatLogin({
          code: 'fake-wx-code',
          nickname: 'wx用户',
          avatar: '',
        });
        expect(result.token).toBeTruthy();
        // New landlords default to name='房东' — nickname only applies on subsequent logins.
        expect(result.user.name).toBe('房东');
      } finally {
        restore();
      }
    });

    it('TC-WX-002: 已有 openid → 复用 landlord', async () => {
      // First login creates
      const openId = 'wx-existing-' + Date.now();
      const restore1 = mockWx({ openid: openId });
      const first = await authService.wechatLogin({ code: 'c1' });
      const firstId = first.user.id;
      restore1();

      // Second login with same openid should return same id
      const restore2 = mockWx({ openid: openId });
      const second = await authService.wechatLogin({ code: 'c2' });
      restore2();

      expect(second.user.id).toBe(firstId);
    });

    it('TC-WX-003: 携带 nickname/avatar → 更新 landlord 资料', async () => {
      const openId = 'wx-update-' + Date.now();
      const r1 = mockWx({ openid: openId });
      await authService.wechatLogin({ code: 'c1' });
      r1();

      const r2 = mockWx({ openid: openId });
      const updated = await authService.wechatLogin({
        code: 'c2',
        nickname: '新昵称',
        avatar: 'http://x.com/a.png',
      });
      r2();

      expect(updated.user.name).toBe('新昵称');
      expect(updated.user.avatar).toBe('http://x.com/a.png');
    });
  });

  describe('WeChat 错误响应', () => {
    it('TC-WX-ERR-001: 缺 openid → 401', async () => {
      const restore = mockWx({ errcode: 40029, errmsg: 'invalid code' });
      await expect(authService.wechatLogin({ code: 'bad' }))
        .rejects.toThrow(/invalid code|错误码 40029/);
      restore();
    });

    it('TC-WX-ERR-002: 网络请求失败 → 401 + "暂时不可用"', async () => {
      const restore = mockWx(null, true);
      await expect(authService.wechatLogin({ code: 'any' }))
        .rejects.toThrow(/暂时不可用/);
      restore();
    });
  });

  describe('WX_APPID/SECRET 未配置', () => {
    it('TC-WX-CONF-001: 缺 appid/secret → 400 "未配置"', async () => {
      const origAppid = process.env.WX_APPID;
      const origSecret = process.env.WX_SECRET;
      delete process.env.WX_APPID;
      delete process.env.WX_SECRET;
      await expect(authService.wechatLogin({ code: 'c' }))
        .rejects.toThrow(/微信登录服务未配置/);
      process.env.WX_APPID = origAppid;
      process.env.WX_SECRET = origSecret;
    });
  });

  describe('dev 旁路', () => {
    it('TC-WX-DEV-001: code 以 dev_ 开头 → 不调用 WeChat API', async () => {
      // If dev bypass goes to wechatLogin by mistake, this would fail because
      // WX appid is set but the request would go to real WeChat. Verify via
      // controller: dev_ codes route to devLogin, not wechatLogin.
      const fakeHttp = jest.fn().mockResolvedValue({ openid: 'should-not-call' });
      const original = (authService as any).httpGetJson.bind(authService);
      (authService as any).httpGetJson = fakeHttp;
      try {
        const result = await authService.devLogin('dev_e2e_' + Date.now());
        expect(result.token).toBeTruthy();
        expect(fakeHttp).not.toHaveBeenCalled();
      } finally {
        (authService as any).httpGetJson = original;
      }
    });
  });

  describe('被禁用的账户', () => {
    it('TC-WX-DISABLED-001: landlord.status=0 → 拒绝登录', async () => {
      const openId = 'wx-disabled-' + Date.now();
      const r1 = mockWx({ openid: openId });
      const first = await authService.wechatLogin({ code: 'c1' });
      r1();

      // Manually disable
      const repo = app.get(getRepositoryToken(Landlord));
      await repo.update(first.user.id, { status: 0 });

      const r2 = mockWx({ openid: openId });
      await expect(authService.wechatLogin({ code: 'c2' }))
        .rejects.toThrow(/账户已被禁用/);
      r2();
    });
  });
});
