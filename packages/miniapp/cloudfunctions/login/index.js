const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 登录云函数
 * 获取用户 OPENID 并返回
 */
exports.main = async (event, context) => {
  const { OPENID, APPID, UNIONID } = cloud.getWXContext();

  return {
    openid: OPENID,
    appid: APPID,
    unionid: UNIONID || '',
  };
};
