const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: -1,
      message: '未登录，请先登录'
    });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    req.userId = decoded.userId;
    req.openid = decoded.openid;
    req.role = decoded.role;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: -1,
        message: '登录已过期，请重新登录'
      });
    }
    return res.status(401).json({
      code: -1,
      message: '无效的登录凭证'
    });
  }
};
