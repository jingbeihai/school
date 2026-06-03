const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Submission = sequelize.define('Submission', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  homework_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  student_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  answers: { type: DataTypes.JSON, comment: '逐题作答 [{questionId, userAnswer, isCorrect, comment, score}]' },
  total_score: { type: DataTypes.INTEGER, defaultValue: 0, comment: '总得分' },
  comment: { type: DataTypes.TEXT, comment: '教师总评语' },
  submit_time: { type: DataTypes.DATE, comment: '提交时间' },
  review_time: { type: DataTypes.DATE, comment: '批改时间' },
  reviewer_id: { type: DataTypes.INTEGER.UNSIGNED, comment: '批改人(教师)' },
  status: { type: DataTypes.ENUM('pending', 'submitting', 'submitted', 'reviewed'), defaultValue: 'pending', comment: '状态' },
  has_new_comment: { type: DataTypes.TINYINT(1), defaultValue: 0, comment: '是否有新评语' }
}, {
  tableName: 'submissions',
  indexes: [{ fields: ['homework_id'] }, { fields: ['student_id'] }, { fields: ['status'] }]
});

module.exports = Submission;
