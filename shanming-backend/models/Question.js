const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Question = sequelize.define('Question', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  teacher_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, comment: '出题教师' },
  type: { type: DataTypes.ENUM('single', 'multiple', 'fill', 'judge', 'essay', 'recite'), allowNull: false, comment: '题型' },
  content: { type: DataTypes.TEXT, allowNull: false, comment: '题目内容(富文本)' },
  options: { type: DataTypes.JSON, comment: '选项(选择题)' },
  answer: { type: DataTypes.TEXT, allowNull: false, comment: '正确答案' },
  explanation: { type: DataTypes.TEXT, comment: '解析' },
  difficulty: { type: DataTypes.TINYINT, defaultValue: 0, comment: '难度0-5' },
  is_public: { type: DataTypes.TINYINT(1), defaultValue: 0, comment: '是否共享' }
}, {
  tableName: 'questions',
  indexes: [{ fields: ['teacher_id'] }, { fields: ['type'] }, { fields: ['is_public'] }]
});

module.exports = Question;
