const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { SharedQuestion, Question, User } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

router.get('/questions', auth, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const questionWhere = { is_public: 1 };
    if (type) questionWhere.type = type;
    const { rows, count } = await SharedQuestion.findAndCountAll({
      include: [{ model: Question, where: questionWhere }, { model: User, as: 'sharer', attributes: ['id', 'real_name', 'nickname'] }],
      order: [['shared_at', 'DESC']],
      limit: parseInt(pageSize), offset
    });
    const result = rows.map(r => ({ sharedAt: r.shared_at, sharer: r.sharer, question: r.Question }));
    res.json(Response.paginate(result, count, parseInt(page), parseInt(pageSize)));
  } catch (err) { next(err); }
});

router.post('/reuse', auth, async (req, res, next) => {
  try {
    const { questionIds } = req.body;
    if (!questionIds || !questionIds.length) return res.status(400).json(Response.fail('请选择题目'));
    const sharedQuestions = await Question.findAll({ where: { id: { [Op.in]: questionIds }, is_public: 1 } });
    const newQuestions = sharedQuestions.map(q => ({ teacher_id: req.userId, type: q.type, content: q.content, options: q.options, answer: q.answer, explanation: q.explanation, difficulty: q.difficulty, is_public: 0 }));
    const created = await Question.bulkCreate(newQuestions);
    res.json(Response.success(created, '复用成功'));
  } catch (err) { next(err); }
});

module.exports = router;
