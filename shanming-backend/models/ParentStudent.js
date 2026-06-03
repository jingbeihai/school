const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ParentStudent = sequelize.define('ParentStudent', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  parent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  student_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }
}, {
  tableName: 'parent_students',
  indexes: [{ fields: ['parent_id'] }, { fields: ['student_id'] }]
});

module.exports = ParentStudent;
