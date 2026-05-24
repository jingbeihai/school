// cloudfunctions/submitHomeworkAnswers/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { homeworkId, answers } = event

  if (!homeworkId || !answers || !Array.isArray(answers)) {
    return { success: false, message: '参数无效' }
  }

  try {
    // 验证学生身份
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const student = userRes.data[0]

    // 获取作业信息
    const hwRes = await db.collection('homework').doc(homeworkId).get()
    if (!hwRes.data) return { success: false, message: '作业不存在' }

    // 检查是否已提交
    const existRes = await db.collection('submissions')
      .where({ homeworkId, studentId: student._id })
      .get()
    if (existRes.data && existRes.data.length > 0) {
      return { success: false, message: '你已提交过该作业' }
    }

    // 获取所有题目及其正确答案
    const hqRes = await db.collection('homework_questions')
      .where({ homeworkId })
      .orderBy('order', 'asc')
      .get()

    const questionIds = hqRes.data.map(hq => hq.questionId)
    const qRes = await db.collection('questions')
      .where({ _id: _.in(questionIds) })
      .get()

    const questionMap = {}
    qRes.data.forEach(q => { questionMap[q._id] = q })

    // 批改：比对答案
    let correctCount = 0
    const gradedAnswers = answers.map(ans => {
      const question = questionMap[ans.questionId]
      if (!question) {
        return { questionId: ans.questionId, userAnswer: ans.userAnswer, isCorrect: false }
      }

      let isCorrect = false
      if (question.type === 'multiple_choice') {
        // 多选：归一化后比对
        const normalize = (s) => {
          const chars = (s || '').replace(/[^a-zA-Z]/g, '').toUpperCase()
          return chars.split('').sort().join('')
        }
        isCorrect = normalize(ans.userAnswer) === normalize(question.answer)
      } else {
        // 其他类型：直接比对（去掉首尾空格）
        isCorrect = (ans.userAnswer || '').trim() === (question.answer || '').trim()
      }

      if (isCorrect) correctCount++
      return {
        questionId: ans.questionId,
        userAnswer: ans.userAnswer || '',
        isCorrect
      }
    })

    // 写入提交记录
    const submitData = {
      homeworkId,
      studentId: student._id,
      studentName: student.nickName || '学生',
      status: 'submitted',
      submitTime: new Date(),
      correctCount,
      totalCount: gradedAnswers.length,
      answers: gradedAnswers
    }

    const result = await db.collection('submissions').add({ data: submitData })

    return {
      success: true,
      submission: {
        _id: result._id,
        correctCount,
        totalCount: gradedAnswers.length,
        answers: gradedAnswers
      }
    }
  } catch (err) {
    console.error('submitHomeworkAnswers error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
