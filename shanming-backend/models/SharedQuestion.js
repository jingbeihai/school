const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SharedQuestion = sequelize.define('SharedQuestion', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  question_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  shared_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }
}, {
  tableName: 'shared_questions',
  timestamps: true,
  createdAt: 'shared_at',
  updatedAt: false
});

module.exports = SharedQuestion;
