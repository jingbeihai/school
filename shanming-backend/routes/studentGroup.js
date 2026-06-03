const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { StudentQuestionGroup, StudentGroupQuestion, Question } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

router.post('/create', auth, async (req, res, next) => {
  try {
    if (req.role !== 'student') return res.status(403).json(Response.fail('仅学生可操作'));
    const { name, type = 'favorite' } = req.body;
    if (!name) return res.status(400).json(Response.fail('请输入组名'));
    const group = await StudentQuestionGroup.create({ student_id: req.userId, name, type });
    res.json(Response.success(group));
  } catch (err) { next(err); }
});

router.get('/list', auth, async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = { student_id: req.userId };
    if (type) where.type = type;
    const groups = await StudentQuestionGroup.findAll({ where, order: [['created_at', 'DESC']] });
    const result = await Promise.all(groups.map(async (g) => {
      const questionCount = await StudentGroupQuestion.count({ where: { group_id: g.id } });
      return { id: g.id, name: g.name, type: g.type, questionCount, createdAt: g.created_at };
    }));
    res.json(Response.success(result));
  } catch (err) { next(err); }
});

router.delete('/delete', auth, async (req, res, next) => {
  try {
    const { id } = req.body;
    const group = await StudentQuestionGroup.findOne({ where: { id, student_id: req.userId } });
    if (!group) return res.status(404).json(Response.fail('分组不存在'));
    await group.destroy();
    res.json(Response.success(null, '删除成功'));
  } catch (err) { next(err); }
});

router.get('/questions', auth, async (req, res, next) => {
  try {
    const { groupId } = req.query;
    const group = await StudentQuestionGroup.findOne({
      where: { id: groupId, student_id: req.userId },
      include: [{ model: Question, through: { attributes: ['sort_order'] } }],
      order: [[StudentGroupQuestion, 'sort_order', 'ASC']]
    });
    if (!group) return res.status(404).json(Response.fail('分组不存在'));
    res.json(Response.success({ id: group.id, name: group.name, type: group.type, questions: group.Questions || [] }));
  } catch (err) { next(err); }
});

router.post('/add-questions', auth, async (req, res, next) => {
  try {
    const { groupId, questionIds } = req.body;
    if (!groupId || !questionIds || !questionIds.length) return res.status(400).json(Response.fail('参数错误'));
    const group = await StudentQuestionGroup.findOne({ where: { id: groupId, student_id: req.userId } });
    if (!group) return res.status(404).json(Response.fail('分组不存在'));
    const maxOrder = await StudentGroupQuestion.max('sort_order', { where: { group_id: groupId } });
    const items = questionIds.map((qid, index) => ({ group_id: parseInt(groupId), question_id: qid, sort_order: (maxOrder || 0) + index + 1 }));
    await StudentGroupQuestion.bulkCreate(items, { ignoreDuplicates: true });
    res.json(Response.success(null, '添加成功'));
  } catch (err) { next(err); }
});

router.post('/remove-questions', auth, async (req, res, next) => {
  try {
    const { groupId, questionIds } = req.body;
    await StudentGroupQuestion.destroy({ where: { group_id: groupId, question_id: { [Op.in]: questionIds } } });
    res.json(Response.success(null, '移除成功'));
  } catch (err) { next(err); }
});

router.post('/move-questions', auth, async (req, res, next) => {
  try {
    const { fromGroupId, toGroupId, questionIds } = req.body;
    const groups = await StudentQuestionGroup.findAll({ where: { id: { [Op.in]: [fromGroupId, toGroupId] }, student_id: req.userId } });
    if (groups.length !== 2) return res.status(404).json(Response.fail('分组不存在或无权限'));
    await StudentGroupQuestion.destroy({ where: { group_id: fromGroupId, question_id: { [Op.in]: questionIds } } });
    const maxOrder = await StudentGroupQuestion.max('sort_order', { where: { group_id: toGroupId } });
    const items = questionIds.map((qid, index) => ({ group_id: parseInt(toGroupId), question_id: qid, sort_order: (maxOrder || 0) + index + 1 }));
    await StudentGroupQuestion.bulkCreate(items, { ignoreDuplicates: true });
    res.json(Response.success(null, '移动成功'));
  } catch (err) { next(err); }
});

module.exports = router;
