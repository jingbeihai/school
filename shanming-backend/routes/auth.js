const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { User } = require('../models');
const WeChat = require('../utils/wx');
const config = require('../config');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

async function generateUniqueUserCode() {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(Math.random() * 900000) + 100000);
    const existed = await User.count({ where: { user_code: code } });
    if (!existed) return code;
  }
  throw new Error('生成唯一 userCode 失败');
}

function formatUserInfo(user) {
  return {
    _id: user.id,
    openId: user.openid,
    role: user.role,
    nickName: user.nickname || '',
    phone: user.phone || '',
    avatarUrl: user.avatar || '',
    isVip: !!user.is_vip,
    createTime: user.created_at ? new Date(user.created_at).getTime() : Date.now(),
    vipExpireDate: user.vip_expire_date ? new Date(user.vip_expire_date).getTime() : null,
    status: user.status || 'active',
    userCode: user.user_code || ''
  };
}

// POST /api/auth/wx-login - 微信登录（兼容云函数 login）
router.post('/wx-login', async (req, res, next) => {
  try {
    const { code, role, nickName, avatarUrl } = req.body;
    if (!code) return res.status(400).json(Response.fail('缺少登录 code'));
    if (!role) return res.status(400).json(Response.fail('请选择角色'));
    if (!['teacher', 'student', 'parent'].includes(role)) {
      return res.status(400).json(Response.fail('无效的角色类型'));
    }

    const { openid } = await WeChat.code2Session(code);
    let user = await User.findOne({ where: { openid, role } });

    if (user) {
      const updateData = {};
      if (user.is_vip && user.vip_expire_date && new Date() > user.vip_expire_date) {
        updateData.is_vip = 0;
      }
      if (nickName && nickName !== user.nickname) updateData.nickname = nickName;
      if (avatarUrl && avatarUrl !== user.avatar) updateData.avatar = avatarUrl;
      if (Object.keys(updateData).length > 0) {
        await user.update(updateData);
        user = await User.findByPk(user.id);
      }
    } else {
      const roleNames = { teacher: '教师', student: '学生', parent: '家长' };
      const userCode = await generateUniqueUserCode();
      const vipExpire = new Date();
      vipExpire.setDate(vipExpire.getDate() + 14);
      user = await User.create({
        openid,
        role,
        nickname: nickName || `${roleNames[role] || '用户'}${userCode}`,
        avatar: avatarUrl || '',
        user_code: userCode,
        is_vip: 1,
        vip_expire_date: vipExpire,
        free_trial_used: 1,
        status: 'active'
      });
    }

    const token = jwt.sign(
      { userId: user.id, openid: user.openid, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json(Response.success({
      token,
      userInfo: formatUserInfo(user)
    }));
  } catch (err) { next(err); }
});

router.post('/register', auth, async (req, res, next) => {
  try {
    const { role, realName, phone, userCode } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json(Response.fail('用户不存在'));

    const updateData = {};
    if (role) updateData.role = role;
    if (realName !== undefined) updateData.real_name = realName;
    if (phone !== undefined) updateData.phone = phone;
    if (userCode !== undefined) updateData.user_code = userCode;
    await user.update(updateData);

    res.json(Response.success(formatUserInfo(user)));
  } catch (err) { next(err); }
});

router.get('/check', auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json(Response.fail('用户不存在'));
    res.json(Response.success(formatUserInfo(user)));
  } catch (err) { next(err); }
});

module.exports = router;
