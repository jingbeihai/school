const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Class = sequelize.define('Class', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(200), allowNull: false, comment: '班级名称' },
  teacher_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, comment: '创建教师ID' },
  teacher_name: { type: DataTypes.STRING(100), defaultValue: '', comment: '教师昵称' },
  invite_code: { type: DataTypes.STRING(20), allowNull: false, unique: true, comment: '邀请码' },
  subject: { type: DataTypes.STRING(100), defaultValue: '', comment: '科目' },
  description: { type: DataTypes.TEXT, comment: '班级简介' },
  student_count: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0, comment: '学生人数' },
  status: { type: DataTypes.ENUM('active', 'archived'), defaultValue: 'active' }
}, {
  tableName: 'classes',
  indexes: [{ fields: ['teacher_id'] }, { fields: ['invite_code'] }]
});

module.exports = Class;
