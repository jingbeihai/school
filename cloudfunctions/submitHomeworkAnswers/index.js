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
    let existingSubmission = null
    const existRes = await db.collection('submissions')
      .where({ homeworkId, studentId: student._id })
      .get()
    if (existRes.data && existRes.data.length > 0) {
      const sub = existRes.data[0]
      // 已最终提交的不可重复提交
      if (sub.status === 'submitted') {
        return { success: false, message: '你已提交过该作业' }
      }
      // 逐题进行中的状态：继续合并提交
      existingSubmission = sub
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

    // 批改新提交的答案
    const newGraded = answers.map(ans => {
      const question = questionMap[ans.questionId]
      if (!question) {
        return { questionId: ans.questionId, userAnswer: ans.userAnswer, isCorrect: false }
      }

      let isCorrect = false
      if (question.type === 'multiple_choice') {
        const normalize = (s) => {
          const chars = (s || '').replace(/[^a-zA-Z]/g, '').toUpperCase()
          return chars.split('').sort().join('')
        }
        isCorrect = normalize(ans.userAnswer) === normalize(question.answer)
      } else {
        isCorrect = (ans.userAnswer || '').trim() === (question.answer || '').trim()
      }

      return {
        questionId: ans.questionId,
        userAnswer: ans.userAnswer || '',
        isCorrect
      }
    })

    // 合并已有答案（逐题提交的）和新答案
    const answerMap = {}
    if (existingSubmission && existingSubmission.answers) {
      existingSubmission.answers.forEach(a => { answerMap[a.questionId] = a })
    }
    newGraded.forEach(a => { answerMap[a.questionId] = a })  // 新答案覆盖或追加

    const mergedAnswers = Object.values(answerMap)
    const correctCount = mergedAnswers.filter(a => a.isCorrect).length

    // 写入或更新提交记录
    const submitData = {
      homeworkId,
      studentId: student._id,
      studentName: student.nickName || '学生',
      status: 'submitted',
      submitTime: new Date(),
      correctCount,
      totalCount: mergedAnswers.length,
      answers: mergedAnswers
    }

    let submissionId
    if (existingSubmission) {
      await db.collection('submissions').doc(existingSubmission._id).update({ data: submitData })
      submissionId = existingSubmission._id
    } else {
      const result = await db.collection('submissions').add({ data: submitData })
      submissionId = result._id
    }

    // 自动将错题加入「默认错题本」（只处理本次新提交的错题，逐题提交时已单独处理）
    const wrongAnswers = newGraded.filter(a => !a.isCorrect)
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
        _id: submissionId,
        correctCount,
        totalCount: mergedAnswers.length,
        answers: mergedAnswers
      }
    }
  } catch (err) {
    console.error('submitHomeworkAnswers error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
