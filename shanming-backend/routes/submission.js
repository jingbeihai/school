const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Submission, Homework, HomeworkQuestion, Question, User, ClassStudent, StudentQuestionGroup, StudentGroupQuestion } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

function gradeAnswer(question, userAnswer) {
  if (question.type === 'multiple_choice' || question.type === 'multiple') {
    const normalize = (s) => (s || '').replace(/[^a-zA-Z]/g, '').toUpperCase().split('').sort().join('');
    return normalize(userAnswer) === normalize(question.answer);
  }
  return (userAnswer || '').trim() === (question.answer || '').trim();
}

router.post('/submit-answer', auth, async (req, res, next) => {
  try {
    if (req.role !== 'student') return res.status(403).json(Response.fail('无权操作'));
    const { homeworkId, questionId, userAnswer } = req.body;
    if (!homeworkId || !questionId) return res.status(400).json(Response.fail('参数不完整'));

    const homework = await Homework.findByPk(homeworkId);
    if (!homework) return res.status(404).json(Response.fail('作业不存在'));
    const question = await Question.findByPk(questionId);
    if (!question) return res.status(404).json(Response.fail('题目不存在'));

    const isCorrect = gradeAnswer(question, userAnswer);
    const student = await User.findByPk(req.userId);

    let submission = await Submission.findOne({ where: { homework_id: homeworkId, student_id: req.userId } });
    if (!submission) {
      submission = await Submission.create({
        homework_id: homeworkId, student_id: req.userId,
        status: 'submitting', submit_time: new Date(), answers: []
      });
    }

    let answers = submission.answers || [];
    const existingIdx = answers.findIndex(a => String(a.questionId) === String(questionId));
    const answerEntry = { questionId, userAnswer: userAnswer || '', isCorrect };
    if (existingIdx >= 0) answers[existingIdx] = answerEntry;
    else answers.push(answerEntry);

    const correctCount = answers.filter(a => a.isCorrect).length;
    await submission.update({ answers, status: 'submitting', submit_time: new Date() });

    if (!isCorrect) {
      let errorGroup = await StudentQuestionGroup.findOne({
        where: { student_id: req.userId, type: 'wrong', name: '默认错题本' }
      });
      if (!errorGroup) {
        errorGroup = await StudentQuestionGroup.create({
          student_id: req.userId, name: '默认错题本', type: 'wrong'
        });
      }
      const exists = await StudentGroupQuestion.findOne({ where: { group_id: errorGroup.id, question_id: questionId } });
      if (!exists) {
        await StudentGroupQuestion.create({ group_id: errorGroup.id, question_id: questionId, sort_order: 1 });
      }
    }

    res.json(Response.success({
      isCorrect, correctAnswer: question.answer, explanation: question.explanation || '',
      correctCount, totalCount: answers.length
    }));
  } catch (err) { next(err); }
});

router.get('/student-homework-detail', auth, async (req, res, next) => {
  try {
    const { homeworkId, studentId } = req.query;
    if (!homeworkId || !studentId) return res.status(400).json(Response.fail('缺少参数'));

    const homework = await Homework.findByPk(homeworkId);
    if (!homework) return res.status(404).json(Response.fail('作业不存在'));
    if (req.role === 'teacher' && homework.teacher_id !== req.userId) {
      return res.status(403).json(Response.fail('无权查看此作业'));
    }
    if (req.role === 'student' && String(studentId) !== String(req.userId)) {
      return res.status(403).json(Response.fail('无权查看他人的提交'));
    }

    const submission = await Submission.findOne({ where: { homework_id: homeworkId, student_id: studentId } });
    if (!submission || !submission.answers || !submission.answers.length) {
      return res.json(Response.success({ empty: true, message: '该学生尚未提交' }));
    }

    const hqList = await HomeworkQuestion.findAll({
      where: { homework_id: homeworkId },
      include: [{ model: Question }],
      order: [['sort_order', 'ASC']]
    });

    const student = await User.findByPk(studentId);
    const questions = hqList.map(hq => {
      const q = hq.Question;
      if (!q) return null;
      const answer = (submission.answers || []).find(a => String(a.questionId) === String(q.id));
      return {
        _id: q.id, questionId: q.id, type: q.type, content: q.content,
        options: q.options || [], answer: q.answer, explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        userAnswer: answer ? answer.userAnswer : null,
        isCorrect: answer ? !!answer.isCorrect : false,
        hasSubmitted: !!answer,
        comment: answer ? (answer.comment || '') : ''
      };
    }).filter(Boolean);

    if (submission.has_new_comment) {
      await submission.update({ has_new_comment: 0 });
    }

    res.json(Response.success({
      submissionId: submission.id,
      homeworkInfo: { _id: homework.id, title: homework.title, deadline: homework.deadline },
      studentName: student ? (student.nickname || student.real_name || '') : '',
      questions,
      correctCount: (submission.answers || []).filter(a => a.isCorrect).length,
      totalCount: (submission.answers || []).length,
      teacherComment: submission.comment || ''
    }));
  } catch (err) { next(err); }
});

router.post('/submit', auth, async (req, res, next) => {
  try {
    if (req.role !== 'student') return res.status(403).json(Response.fail('仅学生可提交作业'));
    const { homeworkId, answers } = req.body;
    if (!homeworkId || !answers) return res.status(400).json(Response.fail('缺少必要参数'));
    const homework = await Homework.findByPk(homeworkId);
    if (!homework) return res.status(404).json(Response.fail('作业不存在'));
    if (homework.status !== 'active') return res.status(400).json(Response.fail('作业已结束'));

    let submission = await Submission.findOne({ where: { homework_id: homeworkId, student_id: req.userId } });
    if (submission) {
      if (submission.status === 'submitted') return res.status(400).json(Response.fail('您已提交过该作业'));
      await submission.update({ answers, status: 'submitted', submit_time: new Date() });
      return res.json(Response.success(submission, '提交成功'));
    }

    submission = await Submission.create({ homework_id: homeworkId, student_id: req.userId, answers, status: 'submitted', submit_time: new Date() });
    await homework.increment('submitted_count');
    res.json(Response.success(submission, '提交成功'));
  } catch (err) { next(err); }
});

router.post('/review', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可批改'));
    const { submissionId, questionId, comment, answers, totalScore } = req.body;
    const submission = await Submission.findByPk(submissionId);
    if (!submission) return res.status(404).json(Response.fail('提交记录不存在'));

    const updateData = { review_time: new Date(), reviewer_id: req.userId, has_new_comment: 1 };
    if (questionId) {
      const currentAnswers = submission.answers || [];
      const idx = currentAnswers.findIndex(a => String(a.questionId) === String(questionId));
      if (idx === -1) return res.status(404).json(Response.fail('题目不存在'));
      currentAnswers[idx].comment = comment || '';
      updateData.answers = currentAnswers;
    } else {
      if (comment !== undefined) updateData.comment = comment;
      if (answers) updateData.answers = answers;
      if (totalScore !== undefined) updateData.total_score = totalScore;
      updateData.status = 'reviewed';
    }
    await submission.update(updateData);
    res.json(Response.success(null, '批改完成'));
  } catch (err) { next(err); }
});

router.get('/student-list', auth, async (req, res, next) => {
  try {
    if (req.role !== 'student') return res.status(403).json(Response.fail('仅学生可查看'));
    const { classId } = req.query;
    const submissions = await Submission.findAll({
      where: { student_id: req.userId },
      include: [{ model: Homework, where: classId ? { class_id: classId } : {}, include: [{ model: User, as: 'teacher', attributes: ['real_name', 'nickname'] }] }],
      order: [['submit_time', 'DESC']]
    });
    res.json(Response.success(submissions));
  } catch (err) { next(err); }
});

router.get('/detail', auth, async (req, res, next) => {
  try {
    const { id, homeworkId } = req.query;
    let submission;
    if (id) {
      submission = await Submission.findByPk(id, { include: [{ model: Homework }, { model: User, as: 'student', attributes: ['id', 'real_name', 'nickname', 'avatar'] }] });
    } else if (homeworkId) {
      submission = await Submission.findOne({ where: { homework_id: homeworkId, student_id: req.userId }, include: [{ model: Homework }, { model: User, as: 'student', attributes: ['id', 'real_name', 'nickname', 'avatar'] }] });
    }
    if (!submission) return res.status(404).json(Response.fail('提交记录不存在'));

    const questions = await Question.findAll({
      include: [{ model: Homework, where: { id: submission.homework_id }, through: { attributes: ['sort_order', 'score'] } }],
      order: [[HomeworkQuestion, 'sort_order', 'ASC']]
    });
    res.json(Response.success({ submission, questions }));
  } catch (err) { next(err); }
});

router.post('/save-draft', auth, async (req, res, next) => {
  try {
    const { homeworkId, answers } = req.body;
    let submission = await Submission.findOne({ where: { homework_id: homeworkId, student_id: req.userId } });
    if (submission) await submission.update({ answers, status: 'pending' });
    else submission = await Submission.create({ homework_id: homeworkId, student_id: req.userId, answers, status: 'pending' });
    res.json(Response.success(null, '草稿已保存'));
  } catch (err) { next(err); }
});

module.exports = router;
