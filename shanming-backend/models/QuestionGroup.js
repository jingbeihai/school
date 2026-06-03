const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const QuestionGroup = sequelize.define('QuestionGroup', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  teacher_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false, comment: '组名' }
}, {
  tableName: 'question_groups',
  indexes: [{ fields: ['teacher_id'] }]
});

module.exports = QuestionGroup;
