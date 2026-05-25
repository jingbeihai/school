// cloudfunctions/submitAnswer/index.js
// 逐题提交：每次只提交一道题，立即批改并返回结果
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { homeworkId, questionId, userAnswer } = event

  if (!homeworkId || !questionId) return { success: false, message: '参数不完整' }

  try {
    // 1. 验证学生身份
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const student = userRes.data[0]

    // 2. 获取作业信息
    const hwRes = await db.collection('homework').doc(homeworkId).get()
    if (!hwRes.data) return { success: false, message: '作业不存在' }

    // 3. 获取题目和正确答案
    const qRes = await db.collection('questions').doc(questionId).get()
    if (!qRes.data) return { success: false, message: '题目不存在' }
    const question = qRes.data

    // 4. 批改
    let isCorrect = false
    if (question.type === 'multiple_choice') {
      const normalize = (s) => {
        const chars = (s || '').replace(/[^a-zA-Z]/g, '').toUpperCase()
        return chars.split('').sort().join('')
      }
      isCorrect = normalize(userAnswer) === normalize(question.answer)
    } else {
      isCorrect = (userAnswer || '').trim() === (question.answer || '').trim()
    }

    // 5. 查找或创建 submission 记录
    let subRes = await db.collection('submissions')
      .where({ homeworkId, studentId: student._id })
      .get()

    let submission
    if (subRes.data && subRes.data.length > 0) {
      submission = subRes.data[0]
    } else {
      const addRes = await db.collection('submissions').add({
        data: {
          homeworkId,
          studentId: student._id,
          studentName: student.nickName || '学生',
          status: 'submitting',
          submitTime: new Date(),
          correctCount: 0,
          totalCount: 0,
          answers: []
        }
      })
      submission = { _id: addRes._id, answers: [], correctCount: 0 }
    }

    // 6. 更新 answers 数组：替换已有或添加新答案
    let answers = submission.answers || []
    const existingIdx = answers.findIndex(a => a.questionId === questionId)
    const answerEntry = { questionId, userAnswer: userAnswer || '', isCorrect }
    const prevCorrect = existingIdx >= 0 ? answers[existingIdx].isCorrect : null

    if (existingIdx >= 0) {
      answers[existingIdx] = answerEntry
    } else {
      answers.push(answerEntry)
    }

    // 重新计算 correctCount
    const correctCount = answers.filter(a => a.isCorrect).length

    // 更新 submission 记录
    await db.collection('submissions').doc(submission._id).update({
      data: {
        answers,
        correctCount,
        totalCount: answers.length,
        submitTime: new Date()
      }
    })

    // 7. 处理错题本（答错时收录）
    if (!isCorrect) {
      let errorGroupRes = { data: [] }
      try {
        errorGroupRes = await db.collection('student_question_groups')
          .where({ studentId: student._id, type: 'error', name: '默认错题本' })
          .get()
      } catch (e) {}

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

      let existTotal = 0
      try {
        const exist = await db.collection('student_group_questions')
          .where({ groupId: errorGroupId, questionId })
          .count()
        existTotal = exist.total
      } catch (e) {}

      if (existTotal === 0) {
        await db.collection('student_group_questions').add({
          data: {
            groupId: errorGroupId,
            questionId,
            addTime: new Date(),
            sourceHomeworkId: homeworkId,
            userAnswer: userAnswer || '',
            correctAnswer: question.answer
          }
        })
      }

      await db.collection('student_question_groups').doc(errorGroupId).update({
        data: { updateTime: new Date() }
      })
    }

    return {
      success: true,
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation || '',
      correctCount,
      totalCount: answers.length
    }
  } catch (err) {
    console.error('submitAnswer error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
