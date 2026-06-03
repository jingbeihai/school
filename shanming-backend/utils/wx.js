const axios = require('axios');
const config = require('../config');

class WeChat {
  static async code2Session(code) {
    try {
      const res = await axios.get(config.wx.loginUrl, {
        params: {
          appid: config.wx.appid,
          secret: config.wx.secret,
          js_code: code,
          grant_type: 'authorization_code'
        }
      });

      const data = res.data;

      if (data.errcode) {
        throw new Error(`微信登录失败: ${data.errmsg} (${data.errcode})`);
      }

      return {
        openid: data.openid,
        session_key: data.session_key,
        unionid: data.unionid || null
      };
    } catch (err) {
      if (err.message && err.message.startsWith('微信登录失败')) {
        throw err;
      }
      throw new Error('调用微信登录接口失败: ' + err.message);
    }
  }
}

module.exports = WeChat;
