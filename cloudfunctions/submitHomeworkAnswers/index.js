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

    // 自动将错题加入「默认错题本」
    const wrongAnswers = gradedAnswers.filter(a => !a.isCorrect)
    if (wrongAnswers.length > 0) {
      // 查找或创建「默认错题本」（集合可能尚未创建）
      let errorGroupRes = { data: [] }
      try {
        errorGroupRes = await db.collection('student_question_groups')
          .where({ studentId: student._id, type: 'error', name: '默认错题本' })
          .get()
      } catch (e) {
        // 集合不存在，data 保持为空，后续走创建逻辑
      }

      let errorGroupId
      if (errorGroupRes.data.length === 0) {
        const createRes = await db.collection('student_question_groups').add({
          data: {
            studentId: student._id,
            name: '默认错题本',
            type: 'error',
            description: '',
            createTime: new Date(),
            updateTime: new Date()
          }
        })
        errorGroupId = createRes._id
      } else {
        errorGroupId = errorGroupRes.data[0]._id
      }

      // 添加错题（去重）
      for (const wrong of wrongAnswers) {
        const question = questionMap[wrong.questionId]
        let existTotal = 0
        try {
          const exist = await db.collection('student_group_questions')
            .where({ groupId: errorGroupId, questionId: wrong.questionId })
            .count()
          existTotal = exist.total
        } catch (e) {
          // 集合不存在则直接添加
        }
        if (existTotal === 0) {
          await db.collection('student_group_questions').add({
            data: {
              groupId: errorGroupId,
              questionId: wrong.questionId,
              addTime: new Date(),
              sourceHomeworkId: homeworkId,
              userAnswer: wrong.userAnswer || '',
              correctAnswer: question ? question.answer : ''
            }
          })
        }
      }

      await db.collection('student_question_groups').doc(errorGroupId).update({
        data: { updateTime: new Date() }
      })
    }

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
