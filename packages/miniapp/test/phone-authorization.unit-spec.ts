import { readPhoneAuthorization } from '../src/utils/phone-authorization';

describe('phone authorization feedback', () => {
  it('accepts a successful code', () => {
    expect(readPhoneAuthorization({ code: 'one-time-code' }).code).toBe('one-time-code');
  });
  it('distinguishes user denial from platform failure', () => {
    expect(readPhoneAuthorization({ errMsg: 'getPhoneNumber:fail user deny' }).cancelled).toBe(true);
    const unavailable = readPhoneAuthorization({ errMsg: 'getPhoneNumber:fail no permission', errno: 104 });
    expect(unavailable.cancelled).toBe(false);
    expect(unavailable.diagnostic).toContain('no permission');
    expect(unavailable.message).not.toContain('请点击');
  });
  it('missing callback data never claims the user refused authorization', () => {
    expect(readPhoneAuthorization().cancelled).toBe(false);
    expect(readPhoneAuthorization().diagnostic).toBe('微信未返回授权结果');
  });
});
