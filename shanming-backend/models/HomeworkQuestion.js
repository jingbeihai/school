const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const HomeworkQuestion = sequelize.define('HomeworkQuestion', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  homework_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  question_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0, comment: '排序' },
  score: { type: DataTypes.INTEGER, defaultValue: 0, comment: '分值' }
}, {
  tableName: 'homework_questions',
  indexes: [{ fields: ['homework_id'] }, { fields: ['question_id'] }]
});

module.exports = HomeworkQuestion;
