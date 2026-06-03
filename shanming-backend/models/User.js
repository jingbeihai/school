const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  openid: { type: DataTypes.STRING(128), allowNull: false, comment: '微信openid' },
  role: { type: DataTypes.ENUM('teacher', 'student', 'parent'), allowNull: false, defaultValue: 'student', comment: '角色' },
  nickname: { type: DataTypes.STRING(100), defaultValue: '', comment: '微信昵称' },
  avatar: { type: DataTypes.STRING(500), defaultValue: '', comment: '头像URL' },
  real_name: { type: DataTypes.STRING(100), defaultValue: '', comment: '真实姓名' },
  phone: { type: DataTypes.STRING(20), defaultValue: '', comment: '手机号' },
  user_code: { type: DataTypes.STRING(50), defaultValue: '', comment: '用户识别码' },
  is_vip: { type: DataTypes.TINYINT(1), defaultValue: 0, comment: '是否VIP' },
  vip_expire_date: { type: DataTypes.DATE, allowNull: true, comment: 'VIP到期时间' },
  free_trial_used: { type: DataTypes.TINYINT(1), defaultValue: 0, comment: '是否已用免费试用' },
  status: { type: DataTypes.STRING(20), defaultValue: 'active', comment: '账号状态' }
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['openid', 'role'] },
    { fields: ['role'] },
    { fields: ['user_code'] }
  ]
});

module.exports = User;
