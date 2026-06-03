const sequelize = require('../config/db');
const User = require('./User');
const Class = require('./Class');
const ClassStudent = require('./ClassStudent');
const Question = require('./Question');
const Homework = require('./Homework');
const HomeworkQuestion = require('./HomeworkQuestion');
const Submission = require('./Submission');
const QuestionGroup = require('./QuestionGroup');
const GroupQuestion = require('./GroupQuestion');
const StudentQuestionGroup = require('./StudentQuestionGroup');
const StudentGroupQuestion = require('./StudentGroupQuestion');
const SharedQuestion = require('./SharedQuestion');
const ParentStudent = require('./ParentStudent');

// ==================== 模型关联定义 ====================

User.hasMany(Class, { foreignKey: 'teacher_id', as: 'classes' });
Class.belongsTo(User, { foreignKey: 'teacher_id', as: 'teacher' });

Class.hasMany(ClassStudent, { foreignKey: 'class_id' });
ClassStudent.belongsTo(Class, { foreignKey: 'class_id' });
User.hasMany(ClassStudent, { foreignKey: 'student_id' });
ClassStudent.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

User.hasMany(Question, { foreignKey: 'teacher_id', as: 'questions' });
Question.belongsTo(User, { foreignKey: 'teacher_id', as: 'teacher' });

Homework.belongsTo(Class, { foreignKey: 'class_id' });
Class.hasMany(Homework, { foreignKey: 'class_id' });
Homework.belongsTo(User, { foreignKey: 'teacher_id', as: 'teacher' });
User.hasMany(Homework, { foreignKey: 'teacher_id' });

Homework.belongsToMany(Question, {
  through: HomeworkQuestion,
  foreignKey: 'homework_id',
  otherKey: 'question_id'
});
Question.belongsToMany(Homework, {
  through: HomeworkQuestion,
  foreignKey: 'question_id',
  otherKey: 'homework_id'
});
Homework.hasMany(HomeworkQuestion, { foreignKey: 'homework_id' });
HomeworkQuestion.belongsTo(Homework, { foreignKey: 'homework_id' });
Question.hasMany(HomeworkQuestion, { foreignKey: 'question_id' });
HomeworkQuestion.belongsTo(Question, { foreignKey: 'question_id' });

Submission.belongsTo(Homework, { foreignKey: 'homework_id' });
Homework.hasMany(Submission, { foreignKey: 'homework_id' });
Submission.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
User.hasMany(Submission, { foreignKey: 'student_id' });

QuestionGroup.belongsToMany(Question, {
  through: GroupQuestion,
  foreignKey: 'group_id',
  otherKey: 'question_id'
});
Question.belongsToMany(QuestionGroup, {
  through: GroupQuestion,
  foreignKey: 'question_id',
  otherKey: 'group_id'
});
QuestionGroup.hasMany(GroupQuestion, { foreignKey: 'group_id' });
GroupQuestion.belongsTo(QuestionGroup, { foreignKey: 'group_id' });

StudentQuestionGroup.belongsToMany(Question, {
  through: StudentGroupQuestion,
  foreignKey: 'group_id',
  otherKey: 'question_id'
});
Question.belongsToMany(StudentQuestionGroup, {
  through: StudentGroupQuestion,
  foreignKey: 'question_id',
  otherKey: 'group_id'
});
StudentQuestionGroup.hasMany(StudentGroupQuestion, { foreignKey: 'group_id' });
StudentGroupQuestion.belongsTo(StudentQuestionGroup, { foreignKey: 'group_id' });

SharedQuestion.belongsTo(Question, { foreignKey: 'question_id' });
Question.hasMany(SharedQuestion, { foreignKey: 'question_id' });
SharedQuestion.belongsTo(User, { foreignKey: 'shared_by', as: 'sharer' });

ParentStudent.belongsTo(User, { foreignKey: 'parent_id', as: 'parent' });
ParentStudent.belongsTo(User, { foreignKey: 'student_id', as: 'child' });
User.hasMany(ParentStudent, { foreignKey: 'parent_id' });
User.hasMany(ParentStudent, { foreignKey: 'student_id' });

module.exports = {
  sequelize,
  User,
  Class,
  ClassStudent,
  Question,
  Homework,
  HomeworkQuestion,
  Submission,
  QuestionGroup,
  GroupQuestion,
  StudentQuestionGroup,
  StudentGroupQuestion,
  SharedQuestion,
  ParentStudent
};
