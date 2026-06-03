const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Question, QuestionGroup, GroupQuestion, SharedQuestion } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

// ===== 题目 CRUD =====
router.post('/create', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可创建题目'));
    const { type, content, options, answer, explanation, difficulty } = req.body;
    if (!type || !content || !answer) return res.status(400).json(Response.fail('缺少必要参数'));
    const question = await Question.create({ teacher_id: req.userId, type, content, options: options || null, answer, explanation: explanation || '', difficulty: difficulty || 0 });
    res.json(Response.success(question));
  } catch (err) { next(err); }
});

router.get('/list', auth, async (req, res, next) => {
  try {
    const { type, page = 1, pageSize = 20 } = req.query;
    const where = { teacher_id: req.userId };
    if (type) where.type = type;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const { rows, count } = await Question.findAndCountAll({ where, order: [['created_at', 'DESC']], limit: parseInt(pageSize), offset });
    res.json(Response.paginate(rows, count, parseInt(page), parseInt(pageSize)));
  } catch (err) { next(err); }
});

router.get('/detail', auth, async (req, res, next) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json(Response.fail('缺少题目ID'));
    const question = await Question.findByPk(id);
    if (!question) return res.status(404).json(Response.fail('题目不存在'));
    res.json(Response.success(question));
  } catch (err) { next(err); }
});

router.put('/update', auth, async (req, res, next) => {
  try {
    const { id, type, content, options, answer, explanation, difficulty } = req.body;
    const question = await Question.findOne({ where: { id, teacher_id: req.userId } });
    if (!question) return res.status(404).json(Response.fail('题目不存在或无权限'));
    const updateData = {};
    if (type) updateData.type = type;
    if (content !== undefined) updateData.content = content;
    if (options !== undefined) updateData.options = options;
    if (answer !== undefined) updateData.answer = answer;
    if (explanation !== undefined) updateData.explanation = explanation;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    await question.update(updateData);
    res.json(Response.success(null, '更新成功'));
  } catch (err) { next(err); }
});

router.delete('/delete', auth, async (req, res, next) => {
  try {
    const { id } = req.body;
    const question = await Question.findOne({ where: { id, teacher_id: req.userId } });
    if (!question) return res.status(404).json(Response.fail('题目不存在或无权限'));
    await question.destroy();
    res.json(Response.success(null, '删除成功'));
  } catch (err) { next(err); }
});

router.post('/share', auth, async (req, res, next) => {
  try {
    const { questionId } = req.body;
    const question = await Question.findOne({ where: { id: questionId, teacher_id: req.userId } });
    if (!question) return res.status(404).json(Response.fail('题目不存在或无权限'));
    const existing = await SharedQuestion.findOne({ where: { question_id: questionId } });
    if (existing) return res.json(Response.fail('该题目已共享'));
    await SharedQuestion.create({ question_id: questionId, shared_by: req.userId });
    await question.update({ is_public: 1 });
    res.json(Response.success(null, '共享成功'));
  } catch (err) { next(err); }
});

// ===== 收藏组（教师） =====
router.post('/group/create', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const { name } = req.body;
    if (!name) return res.status(400).json(Response.fail('请输入组名'));
    const group = await QuestionGroup.create({ teacher_id: req.userId, name });
    res.json(Response.success(group));
  } catch (err) { next(err); }
});

router.get('/group/list', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const groups = await QuestionGroup.findAll({
      where: { teacher_id: req.userId },
      include: [{ model: GroupQuestion, attributes: ['question_id'] }],
      order: [['created_at', 'DESC']]
    });
    const result = groups.map(g => ({ id: g.id, name: g.name, questionCount: g.GroupQuestions ? g.GroupQuestions.length : 0, createdAt: g.created_at }));
    res.json(Response.success(result));
  } catch (err) { next(err); }
});

router.delete('/group/delete', auth, async (req, res, next) => {
  try {
    const { id } = req.body;
    const group = await QuestionGroup.findOne({ where: { id, teacher_id: req.userId } });
    if (!group) return res.status(404).json(Response.fail('分组不存在'));
    await group.destroy();
    res.json(Response.success(null, '删除成功'));
  } catch (err) { next(err); }
});

router.get('/group/questions', auth, async (req, res, next) => {
  try {
    const { groupId } = req.query;
    if (!groupId) return res.status(400).json(Response.fail('缺少组ID'));
    const group = await QuestionGroup.findOne({
      where: { id: groupId },
      include: [{ model: Question, through: { attributes: ['sort_order'] } }],
      order: [[GroupQuestion, 'sort_order', 'ASC']]
    });
    if (!group) return res.status(404).json(Response.fail('分组不存在'));
    res.json(Response.success({ id: group.id, name: group.name, questions: group.Questions || [] }));
  } catch (err) { next(err); }
});

router.post('/group/add-questions', auth, async (req, res, next) => {
  try {
    const { groupId, questionIds } = req.body;
    if (!groupId || !questionIds || !questionIds.length) return res.status(400).json(Response.fail('参数错误'));
    const group = await QuestionGroup.findOne({ where: { id: groupId, teacher_id: req.userId } });
    if (!group) return res.status(404).json(Response.fail('分组不存在'));
    const maxOrder = await GroupQuestion.max('sort_order', { where: { group_id: groupId } });
    const items = questionIds.map((qid, index) => ({ group_id: parseInt(groupId), question_id: qid, sort_order: (maxOrder || 0) + index + 1 }));
    await GroupQuestion.bulkCreate(items, { ignoreDuplicates: true });
    res.json(Response.success(null, '添加成功'));
  } catch (err) { next(err); }
});

router.post('/group/remove-questions', auth, async (req, res, next) => {
  try {
    const { groupId, questionIds } = req.body;
    if (!groupId || !questionIds || !questionIds.length) return res.status(400).json(Response.fail('参数错误'));
    await GroupQuestion.destroy({ where: { group_id: groupId, question_id: { [Op.in]: questionIds } } });
    res.json(Response.success(null, '移除成功'));
  } catch (err) { next(err); }
});

module.exports = router;
