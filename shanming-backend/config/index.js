module.exports = {
  // 微信小程序配置
  wx: {
    appid: process.env.WX_APPID,
    secret: process.env.WX_SECRET,
    loginUrl: 'https://api.weixin.qq.com/sns/jscode2session'
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_me',
    expiresIn: '30d'
  },

  // 文件上传配置
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    avatarDir: 'avatars',
    tempDir: 'temp',
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },

  // DeepSeek API 配置
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiUrl: 'https://api.deepseek.com/v1/chat/completions'
  },

  // 服务器配置
  server: {
    domain: process.env.SERVER_DOMAIN || 'http://localhost:3000'
  }
};
