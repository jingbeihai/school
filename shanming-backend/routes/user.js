const express = require('express');
const router = express.Router();
const { User, Class } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

function formatUserInfo(user) {
  return {
    _id: user.id,
    openId: user.openid,
    role: user.role,
    nickName: user.nickname || '',
    phone: user.phone || '',
    avatarUrl: user.avatar || '',
    isVip: !!user.is_vip,
    vipExpireDate: user.vip_expire_date ? new Date(user.vip_expire_date).getTime() : null,
    status: user.status || 'active',
    userCode: user.user_code || ''
  };
}

router.get('/profile', auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, { attributes: { exclude: ['openid'] } });
    if (!user) return res.status(404).json(Response.fail('用户不存在'));
    res.json(Response.success(formatUserInfo(user)));
  } catch (err) { next(err); }
});

router.put('/profile', auth, async (req, res, next) => {
  try {
    const { nickname, nickName, realName, phone, userCode, avatar, avatarUrl, role } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json(Response.fail('用户不存在'));

    const updateData = {};
    const nameVal = nickName !== undefined ? nickName : nickname;
    const avatarVal = avatarUrl !== undefined ? avatarUrl : avatar;
    if (nameVal !== undefined) updateData.nickname = nameVal;
    if (avatarVal !== undefined) updateData.avatar = avatarVal;
    if (realName !== undefined) updateData.real_name = realName;
    if (phone !== undefined) updateData.phone = phone;
    if (userCode !== undefined) updateData.user_code = userCode;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json(Response.fail('无修改内容'));
    }

    await user.update(updateData);

    if ((role || user.role) === 'teacher' && nameVal) {
      await Class.update({ teacher_name: nameVal }, { where: { teacher_id: req.userId } });
    }

    const updated = await User.findByPk(req.userId);
    res.json(Response.success({ userInfo: formatUserInfo(updated) }));
  } catch (err) { next(err); }
});

module.exports = router;
