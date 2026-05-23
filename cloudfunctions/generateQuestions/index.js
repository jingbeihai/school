const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { DEEPSEEK_API_KEY } = require('./key.js')

exports.main = async (event) => {
  const { userPrompt } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  // 验证教师身份
  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  if (!userPrompt) return { success: false, message: '请输入出题要求' }

  try {
    const prompt = `你是一位专业的出题老师。请根据以下要求生成10道题目，直接返回JSON数组，不要任何额外文字。
要求：${userPrompt}

每道题格式：
{
  "type": "single_choice"/"multiple_choice"/"fill_blank"/"essay",
  "content": "题目内容",
  "options": ["A. xxx", "B. xxx", ...],  // 选择题必填，填空/简答可为空数组
  "answer": "正确答案",
  "explanation": "解析说明",
  "difficulty": "easy"/"medium"/"hard",
  "knowledgePoints": ["知识点1", "知识点2"]
}

只返回JSON数组，格式：[{...},{...}]`

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        timeout: 60000
      }
    )

    let content = response.data?.choices?.[0]?.message?.content || ''
    // 清理markdown代码块标记
    content = content.replace(/```json\s*|```\s*/g, '').trim()

    let questions
    try {
      questions = JSON.parse(content)
      if (!Array.isArray(questions)) throw new Error('返回格式不是数组')
    } catch (e) {
      return { success: false, message: 'AI返回格式解析失败，请重试', raw: content }
    }

    // 保存题目到数据库
    const teacherId = userRes.data[0]._id
    const now = new Date()
    const savedQuestions = []
    for (const q of questions) {
      const res = await db.collection('questions').add({
        data: {
          teacherId,
          type: q.type || 'single_choice',
          content: q.content || '',
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.answer || '',
          explanation: q.explanation || '',
          attachments: [],
          difficulty: q.difficulty || 'medium',
          knowledgePoints: Array.isArray(q.knowledgePoints) ? q.knowledgePoints : [],
          createTime: now,
          lastUsedTime: now
        }
      })
      savedQuestions.push({ ...q, _id: res._id, createTime: now })
    }

    return { success: true, questions: savedQuestions }
  } catch (err) {
    console.error('generateQuestions error:', err)
    return { success: false, message: 'AI调用失败：' + (err.message || '未知错误') }
  }
}
