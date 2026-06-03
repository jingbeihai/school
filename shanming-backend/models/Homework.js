const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Homework = sequelize.define('Homework', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  teacher_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  class_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(300), allowNull: false, comment: '作业标题' },
  description: { type: DataTypes.TEXT, comment: '作业说明' },
  deadline: { type: DataTypes.DATE, comment: '截止时间' },
  status: { type: DataTypes.ENUM('active', 'withdrawn', 'finished'), defaultValue: 'active', comment: '状态' },
  question_count: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0, comment: '题目数量' },
  submitted_count: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0, comment: '已提交人数' }
}, {
  tableName: 'homework',
  indexes: [{ fields: ['teacher_id'] }, { fields: ['class_id'] }, { fields: ['status'] }]
});

module.exports = Homework;
