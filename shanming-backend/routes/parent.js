const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { ParentStudent, User, ClassStudent, Class, Homework, HomeworkQuestion, Submission } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

router.get('/students', auth, async (req, res, next) => {
  try {
    if (req.role !== 'parent') return res.status(403).json(Response.fail('仅家长可查看'));
    const links = await ParentStudent.findAll({ where: { parent_id: req.userId }, include: [{ model: User, as: 'child', attributes: ['id', 'real_name', 'nickname', 'avatar', 'user_code'] }] });
    res.json(Response.success(links.map(l => l.child)));
  } catch (err) { next(err); }
});

router.post('/link', auth, async (req, res, next) => {
  try {
    if (req.role !== 'parent') return res.status(403).json(Response.fail('仅家长可操作'));
    const { studentId, code } = req.body;
    let targetStudentId = studentId;
    if (code) {
      if (code.length !== 6) return res.status(400).json(Response.fail('请输入6位识别码'));
      const student = await User.findOne({ where: { user_code: code, role: 'student' } });
      if (!student) return res.status(404).json(Response.fail('学生账号不存在，请检查识别码'));
      targetStudentId = student.id;
    }
    if (!targetStudentId) return res.status(400).json(Response.fail('请提供学生信息'));
    const student = await User.findOne({ where: { id: targetStudentId, role: 'student' } });
    if (!student) return res.status(404).json(Response.fail('学生不存在'));
    const existing = await ParentStudent.findOne({ where: { parent_id: req.userId, student_id: targetStudentId } });
    if (existing) return res.json(Response.fail('已关联该学生，无需重复关联'));
    await ParentStudent.create({ parent_id: req.userId, student_id: targetStudentId });
    res.json(Response.success(null, '关联成功'));
  } catch (err) { next(err); }
});

router.delete('/unlink', auth, async (req, res, next) => {
  try {
    const { studentId } = req.body;
    await ParentStudent.destroy({ where: { parent_id: req.userId, student_id: studentId } });
    res.json(Response.success(null, '已解除关联'));
  } catch (err) { next(err); }
});

router.get('/student-detail', auth, async (req, res, next) => {
  try {
    const { studentId } = req.query;
    const student = await User.findByPk(studentId, { attributes: ['id', 'real_name', 'nickname', 'avatar', 'user_code'] });
    if (!student) return res.status(404).json(Response.fail('学生不存在'));
    const classIds = await ClassStudent.findAll({ where: { student_id: studentId, status: 'active' }, attributes: ['class_id'] });
    const classes = await Class.findAll({ where: { id: classIds.map(c => c.class_id) } });
    const submissions = await Submission.findAll({ where: { student_id: studentId, status: 'reviewed' }, include: [{ model: Homework, attributes: ['title'] }], order: [['review_time', 'DESC']], limit: 10 });
    res.json(Response.success({ student, classes, recentScores: submissions.map(s => ({ homeworkTitle: s.Homework ? s.Homework.title : '', totalScore: s.total_score, reviewTime: s.review_time })) }));
  } catch (err) { next(err); }
});

router.get('/homework-list', auth, async (req, res, next) => {
  try {
    if (req.role !== 'parent') return res.status(403).json(Response.fail('仅家长可查看'));
    const { studentId } = req.query;

    if (studentId) {
      const classIds = await ClassStudent.findAll({ where: { student_id: studentId, status: 'active' }, attributes: ['class_id'] });
      const homeworkList = await Homework.findAll({ where: { class_id: { [Op.in]: classIds.map(c => c.class_id) }, status: 'active' }, include: [{ model: Class, attributes: ['name'] }], order: [['created_at', 'DESC']] });
      const submissions = await Submission.findAll({ where: { student_id: studentId } });
      const subMap = {};
      submissions.forEach(s => { subMap[s.homework_id] = s; });
      const result = homeworkList.map(h => ({ id: h.id, title: h.title, className: h.Class ? h.Class.name : '', deadline: h.deadline, status: subMap[h.id] ? subMap[h.id].status : 'pending', totalScore: subMap[h.id] ? subMap[h.id].total_score : null, submitTime: subMap[h.id] ? subMap[h.id].submit_time : null }));
      return res.json(Response.success(result));
    }

    const links = await ParentStudent.findAll({
      where: { parent_id: req.userId },
      include: [{ model: User, as: 'child', attributes: ['id', 'nickname', 'real_name'] }]
    });
    if (!links.length) return res.json(Response.success({ list: [] }));

    const studentIds = links.map(l => l.student_id);
    const studentMap = {};
    links.forEach(l => { studentMap[l.student_id] = l.child ? (l.child.nickname || l.child.real_name || '学生') : '学生'; });

    const csList = await ClassStudent.findAll({ where: { student_id: { [Op.in]: studentIds }, status: 'active' } });
    if (!csList.length) return res.json(Response.success({ list: [] }));

    const classIds = [...new Set(csList.map(cs => cs.class_id))];
    const classes = await Class.findAll({ where: { id: { [Op.in]: classIds } } });
    const classMap = {};
    classes.forEach(c => { classMap[c.id] = c.name; });

    const homeworkList = await Homework.findAll({
      where: { class_id: { [Op.in]: classIds }, status: 'active' },
      order: [['created_at', 'DESC']]
    });
    if (!homeworkList.length) return res.json(Response.success({ list: [] }));

    const homeworkIds = homeworkList.map(h => h.id);
    const submissions = await Submission.findAll({
      where: { homework_id: { [Op.in]: homeworkIds }, student_id: { [Op.in]: studentIds } },
      attributes: ['homework_id', 'student_id', 'has_new_comment']
    });
    const newCommentMap = {};
    submissions.forEach(s => { newCommentMap[`${s.homework_id}_${s.student_id}`] = !!s.has_new_comment; });

    const questionCountMap = {};
    for (const hwId of homeworkIds) {
      questionCountMap[hwId] = await HomeworkQuestion.count({ where: { homework_id: hwId } });
    }

    const list = [];
    homeworkList.forEach(hw => {
      const studentsInClass = csList.filter(cs => cs.class_id === hw.class_id);
      studentsInClass.forEach(cs => {
        list.push({
          _id: hw.id, studentId: cs.student_id,
          studentName: studentMap[cs.student_id] || '',
          title: hw.title, className: classMap[hw.class_id] || '',
          publishTime: hw.created_at, deadline: hw.deadline,
          totalCount: questionCountMap[hw.id] || 0,
          hasNewComment: newCommentMap[`${hw.id}_${cs.student_id}`] || false
        });
      });
    });
    res.json(Response.success({ list }));
  } catch (err) { next(err); }
});

module.exports = router;
