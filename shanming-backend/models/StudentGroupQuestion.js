const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StudentGroupQuestion = sequelize.define('StudentGroupQuestion', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  group_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  question_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'student_group_questions',
  indexes: [{ fields: ['group_id'] }, { fields: ['question_id'] }]
});

module.exports = StudentGroupQuestion;
