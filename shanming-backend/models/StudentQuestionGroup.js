const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StudentQuestionGroup = sequelize.define('StudentQuestionGroup', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  student_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  type: { type: DataTypes.ENUM('favorite', 'wrong'), defaultValue: 'favorite', comment: '收藏/错题本' }
}, {
  tableName: 'student_question_groups',
  indexes: [{ fields: ['student_id'] }]
});

module.exports = StudentQuestionGroup;
