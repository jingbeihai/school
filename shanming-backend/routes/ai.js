const express = require('express');
const router = express.Router();
const axios = require('axios');
const Response = require('../utils/response');
const auth = require('../middleware/auth');
const config = require('../config');
const { Question, SharedQuestion } = require('../models');

router.post('/generate-questions', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可使用此功能'));
    const { userPrompt, subject, topic, count = 10, type = 'single_choice' } = req.body;
    const promptText = userPrompt || topic;
    if (!promptText) return res.status(400).json(Response.fail('请输入出题要求'));

    const prompt = userPrompt
      ? `你是一位专业的出题老师。请根据以下要求生成10道题目，直接返回JSON数组，不要任何额外文字。\n要求：${userPrompt}\n\n每道题格式：\n{"type":"single_choice"/"multiple_choice"/"fill_blank"/"essay","content":"题目内容","options":["A. xxx","B. xxx"],"answer":"正确答案","explanation":"解析说明","difficulty":"easy"/"medium"/"hard","knowledgePoints":["知识点1"]}\n\n只返回JSON数组，格式：[{...},{...}]`
      : `你是一个专业的${subject || '学科'}教师。请根据以下要求生成题目：\n\n主题：${topic}\n题型：${type}\n数量：${count}题\n\n请按JSON格式输出：\n{"questions":[{"type":"${type}","content":"题目","options":{"A":"","B":"","C":"","D":""},"answer":"正确答案","explanation":"解析"}]}`;

    const response = await axios.post(config.deepseek.apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的教师，擅长出题。只返回JSON。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    }, {
      headers: { 'Authorization': `Bearer ${config.deepseek.apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000
    });

    let questions;
    try {
      const content = (response.data.choices[0].message.content || '').replace(/```json\s*|```\s*/g, '').trim();
      const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      if (!Array.isArray(questions)) throw new Error('格式错误');
    } catch (e) {
      return res.status(500).json(Response.fail('AI返回格式异常，请重试'));
    }

    const savedQuestions = [];
    for (const q of questions) {
      const created = await Question.create({
        teacher_id: req.userId,
        type: q.type || 'single_choice',
        content: q.content || '',
        options: q.options || null,
        answer: q.answer || '',
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium'
      });
      savedQuestions.push({ ...q, _id: created.id, id: created.id });
      try {
        await SharedQuestion.create({ question_id: created.id, shared_by: req.userId });
        await created.update({ is_public: 1 });
      } catch (e) { /* ignore */ }
    }

    res.json(Response.success({ questions: savedQuestions }));
  } catch (err) {
    if (err.response && err.response.status === 401) return res.status(500).json(Response.fail('DeepSeek API密钥未配置'));
    next(err);
  }
});

router.post('/ocr', auth, async (req, res, next) => {
  try {
    const { imagePath, fileID, url } = req.body;
    if (!imagePath && !fileID && !url) return res.status(400).json(Response.fail('缺少图片路径'));
    res.json(Response.fail('OCR服务尚未配置，请参考迁移文档接入第三方OCR'));
  } catch (err) { next(err); }
});

router.post('/parse-document', auth, async (req, res, next) => {
  try {
    const { filePath, fileID } = req.body;
    if (!filePath && !fileID) return res.status(400).json(Response.fail('缺少文件路径'));
    res.json(Response.fail('文档解析服务尚未配置'));
  } catch (err) { next(err); }
});

module.exports = router;
