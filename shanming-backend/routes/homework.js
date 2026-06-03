const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Homework, HomeworkQuestion, Question, Class, ClassStudent, User, Submission } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

router.post('/publish', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可发布作业'));
    const { classId, title, description, deadline, questionIds } = req.body;
    if (!classId || !questionIds || !questionIds.length) return res.status(400).json(Response.fail('缺少必要参数'));
    const cls = await Class.findOne({ where: { id: classId, teacher_id: req.userId } });
    if (!cls) return res.status(404).json(Response.fail('班级不存在'));

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const autoTitle = title || `${dateStr} ${cls.name}`;
    const dl = deadline ? new Date(deadline) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const homework = await Homework.create({
      teacher_id: req.userId, class_id: classId, title: autoTitle,
      description: description || '', deadline: dl, status: 'active', question_count: questionIds.length
    });
    const items = questionIds.map((qid, index) => ({ homework_id: homework.id, question_id: qid, sort_order: index + 1, score: 0 }));
    await HomeworkQuestion.bulkCreate(items);
    res.json(Response.success({ id: homework.id, homeworkId: homework.id, title: homework.title, questionCount: homework.question_count }, '发布成功'));
  } catch (err) { next(err); }
});

router.get('/list', auth, async (req, res, next) => {
  try {
    const { classId } = req.query;
    const where = {};
    if (req.role === 'teacher') where.teacher_id = req.userId;
    else if (req.role === 'student') {
      const myClasses = await ClassStudent.findAll({ where: { student_id: req.userId, status: 'active' }, attributes: ['class_id'] });
      where.class_id = { [Op.in]: myClasses.map(c => c.class_id) };
    }
    if (classId) where.class_id = classId;
    const list = await Homework.findAll({ where, include: [{ model: Class, attributes: ['id', 'name'] }, { model: User, as: 'teacher', attributes: ['id', 'real_name', 'nickname'] }], order: [['created_at', 'DESC']] });
    res.json(Response.success(list));
  } catch (err) { next(err); }
});

router.get('/detail', auth, async (req, res, next) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json(Response.fail('缺少作业ID'));
    const homework = await Homework.findByPk(id, {
      include: [
        { model: Class, attributes: ['id', 'name'] },
        { model: Question, through: { attributes: ['sort_order', 'score'] } },
        { model: Submission, where: { student_id: req.userId }, required: false }
      ],
      order: [[Question, HomeworkQuestion, 'sort_order', 'ASC']]
    });
    if (!homework) return res.status(404).json(Response.fail('作业不存在'));
    res.json(Response.success({
      id: homework.id, title: homework.title, description: homework.description, deadline: homework.deadline,
      status: homework.status, class: homework.Class, questionCount: homework.question_count,
      submittedCount: homework.submitted_count, questions: homework.Questions || [],
      mySubmission: homework.Submissions && homework.Submissions[0] ? homework.Submissions[0] : null, createdAt: homework.created_at
    }));
  } catch (err) { next(err); }
});

router.get('/for-review', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const homeworks = await Homework.findAll({
      where: { teacher_id: req.userId, status: 'active' },
      include: [{ model: Class, attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']]
    });
    const homeworkList = await Promise.all(homeworks.map(async (hw) => {
      const totalStudents = await ClassStudent.count({ where: { class_id: hw.class_id, status: 'active' } });
      const submissions = await Submission.findAll({ where: { homework_id: hw.id }, attributes: ['answers'] });
      const answeredCount = submissions.filter(s => s.answers && s.answers.length > 0).length;
      return {
        _id: hw.id, title: hw.title, classId: hw.class_id,
        className: hw.Class ? hw.Class.name : '',
        publishTime: hw.created_at, deadline: hw.deadline,
        totalStudents, answeredCount
      };
    }));
    res.json(Response.success({ homeworkList }));
  } catch (err) { next(err); }
});

router.get('/questions', auth, async (req, res, next) => {
  try {
    const { homeworkId, id } = req.query;
    const hwId = homeworkId || id;
    if (!hwId) return res.status(400).json(Response.fail('请提供作业ID'));

    const homework = await Homework.findByPk(hwId, { include: [{ model: Class }] });
    if (!homework) return res.status(404).json(Response.fail('作业不存在'));

    if (req.role === 'teacher' && homework.teacher_id !== req.userId) {
      return res.status(403).json(Response.fail('无权查看此作业'));
    }
    if (req.role === 'student') {
      const inClass = await ClassStudent.findOne({ where: { class_id: homework.class_id, student_id: req.userId, status: 'active' } });
      if (!inClass) return res.status(403).json(Response.fail('你不在该班级中，无权查看此作业'));
    }

    const hqList = await HomeworkQuestion.findAll({
      where: { homework_id: hwId },
      include: [{ model: Question }],
      order: [['sort_order', 'ASC']]
    });

    let questions = hqList.map(hq => {
      const q = hq.Question;
      if (!q) return null;
      const base = q.toJSON();
      base._id = q.id;
      if (req.role === 'student') {
        const { answer, explanation, ...rest } = base;
        return rest;
      }
      return base;
    }).filter(Boolean);

    let existingAnswers = null;
    if (req.role === 'student') {
      const sub = await Submission.findOne({ where: { homework_id: hwId, student_id: req.userId } });
      if (sub && sub.status === 'submitting' && sub.answers) {
        const qMap = {};
        hqList.forEach(hq => { if (hq.Question) qMap[hq.Question.id] = hq.Question; });
        existingAnswers = sub.answers.map(a => ({
          questionId: a.questionId,
          userAnswer: a.userAnswer || '',
          isCorrect: a.isCorrect,
          correctAnswer: qMap[a.questionId] ? qMap[a.questionId].answer || '' : '',
          explanation: qMap[a.questionId] ? qMap[a.questionId].explanation || '' : ''
        }));
      }
    }

    res.json(Response.success({
      homeworkInfo: { _id: homework.id, title: homework.title, deadline: homework.deadline, classId: homework.class_id },
      questions, existingAnswers
    }));
  } catch (err) { next(err); }
});

router.get('/student-homework-list', auth, async (req, res, next) => {
  try {
    if (req.role !== 'student') return res.status(403).json(Response.fail('仅学生可查看'));
    const relations = await ClassStudent.findAll({ where: { student_id: req.userId, status: 'active' } });
    if (!relations.length) return res.json(Response.success({ list: [] }));

    const classIds = relations.map(r => r.class_id);
    const homeworks = await Homework.findAll({
      where: { class_id: { [Op.in]: classIds }, status: 'active' },
      include: [{ model: Class, attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']]
    });
    if (!homeworks.length) return res.json(Response.success({ list: [] }));

    const homeworkIds = homeworks.map(h => h.id);
    const questionCountMap = {};
    for (const hwId of homeworkIds) {
      questionCountMap[hwId] = await HomeworkQuestion.count({ where: { homework_id: hwId } });
    }

    const submissions = await Submission.findAll({ where: { student_id: req.userId, homework_id: { [Op.in]: homeworkIds } } });
    const submissionMap = {};
    submissions.forEach(s => {
      submissionMap[s.homework_id] = {
        submitTime: s.submit_time,
        correctCount: (s.answers || []).filter(a => a.isCorrect).length,
        status: s.status,
        answeredCount: s.status === 'submitted' ? (s.answers || []).length : ((s.answers || []).length),
        hasNewComment: !!s.has_new_comment
      };
    });

    const list = homeworks.map(hw => {
      const sub = submissionMap[hw.id];
      const totalCount = questionCountMap[hw.id] || hw.question_count || 0;
      return {
        _id: hw.id, title: hw.title, classId: hw.class_id,
        className: hw.Class ? hw.Class.name : '',
        publishTime: hw.created_at, deadline: hw.deadline, status: hw.status,
        answeredCount: sub ? sub.answeredCount : 0,
        correctCount: sub ? sub.correctCount : 0,
        totalCount,
        submitTime: sub ? sub.submitTime : null,
        hasNewComment: sub ? sub.hasNewComment : false
      };
    });
    res.json(Response.success({ list }));
  } catch (err) { next(err); }
});

router.get('/review', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const { homeworkId } = req.query;
    if (!homeworkId) return res.status(400).json(Response.fail('缺少作业ID'));
    const submissions = await Submission.findAll({ where: { homework_id: homeworkId }, include: [{ model: User, as: 'student', attributes: ['id', 'real_name', 'nickname', 'avatar', 'user_code'] }], order: [['submit_time', 'DESC']] });
    res.json(Response.success(submissions));
  } catch (err) { next(err); }
});

router.get('/student-progress', auth, async (req, res, next) => {
  try {
    const { homeworkId } = req.query;
    const homework = await Homework.findByPk(homeworkId, { include: [{ model: Class }] });
    if (!homework) return res.status(404).json(Response.fail('作业不存在'));
    const students = await ClassStudent.findAll({ where: { class_id: homework.class_id, status: 'active' }, include: [{ model: User, as: 'student', attributes: ['id', 'real_name', 'nickname', 'avatar'] }] });
    const submissions = await Submission.findAll({ where: { homework_id: homeworkId } });
    const submittedMap = {};
    submissions.forEach(s => { submittedMap[s.student_id] = s; });
    const progress = students.map(cs => ({ student: cs.student, status: submittedMap[cs.student.id] ? submittedMap[cs.student.id].status : 'pending', submitTime: submittedMap[cs.student.id] ? submittedMap[cs.student.id].submit_time : null, totalScore: submittedMap[cs.student.id] ? submittedMap[cs.student.id].total_score : null }));
    res.json(Response.success({ total: progress.length, submitted: Object.keys(submittedMap).length, progress }));
  } catch (err) { next(err); }
});

router.put('/withdraw', auth, async (req, res, next) => {
  try {
    const id = req.body.id || req.body.homeworkId;
    const homework = await Homework.findOne({ where: { id, teacher_id: req.userId } });
    if (!homework) return res.status(404).json(Response.fail('作业不存在或无权限'));
    await homework.update({ status: 'withdrawn' });
    res.json(Response.success(null, '已撤回'));
  } catch (err) { next(err); }
});

router.delete('/delete', auth, async (req, res, next) => {
  try {
    const id = req.body.id || req.body.homeworkId;
    const homework = await Homework.findOne({ where: { id, teacher_id: req.userId } });
    if (!homework) return res.status(404).json(Response.fail('作业不存在或无权限'));
    await homework.destroy();
    res.json(Response.success(null, '删除成功'));
  } catch (err) { next(err); }
});

router.post('/reuse', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const { sourceHomeworkId, classId, title, description, deadline } = req.body;
    const sourceQuestions = await HomeworkQuestion.findAll({ where: { homework_id: sourceHomeworkId }, order: [['sort_order', 'ASC']] });
    if (!sourceQuestions.length) return res.status(400).json(Response.fail('源作业无题目'));
    const homework = await Homework.create({ teacher_id: req.userId, class_id: classId, title, description: description || '', deadline: deadline || null, status: 'active', question_count: sourceQuestions.length });
    const items = sourceQuestions.map((sq, index) => ({ homework_id: homework.id, question_id: sq.question_id, sort_order: index + 1, score: sq.score || 0 }));
    await HomeworkQuestion.bulkCreate(items);
    res.json(Response.success({ id: homework.id, title: homework.title, questionCount: homework.question_count }, '复用发布成功'));
  } catch (err) { next(err); }
});

module.exports = router;
