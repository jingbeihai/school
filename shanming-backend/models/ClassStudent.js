const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ClassStudent = sequelize.define('ClassStudent', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  class_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  student_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  status: { type: DataTypes.ENUM('active', 'left'), defaultValue: 'active' },
  joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'class_students',
  indexes: [{ fields: ['class_id'] }, { fields: ['student_id'] }]
});

module.exports = ClassStudent;
