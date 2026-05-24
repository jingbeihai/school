// cloudfunctions/addQuestionsToStudentGroup/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { groupId, questionIds, homeworkId, userAnswers } = event
  // userAnswers: optional map of { questionId: { userAnswer, correctAnswer } } for error book
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }
  if (!groupId || !questionIds || !questionIds.length) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限' }
    const studentId = userRes.data[0]._id

    const groupRes = await db.collection('student_question_groups')
      .where({ _id: groupId, studentId }).get()
    if (groupRes.data.length === 0) return { success: false, message: '组不存在或无权操作' }

    const now = new Date()
    let addedCount = 0

    for (const qId of questionIds) {
      // 检查是否已在组内（集合可能尚未创建）
      let existTotal = 0
      try {
        const exist = await db.collection('student_group_questions')
          .where({ groupId, questionId: qId }).count()
        existTotal = exist.total
      } catch (e) {
        // 集合不存在则直接添加
      }
      if (existTotal === 0) {
        const data = { groupId, questionId: qId, addTime: now }
        if (homeworkId) data.sourceHomeworkId = homeworkId
        if (userAnswers && userAnswers[qId]) {
          data.userAnswer = userAnswers[qId].userAnswer || ''
          data.correctAnswer = userAnswers[qId].correctAnswer || ''
        }
        await db.collection('student_group_questions').add({ data })
        addedCount++
      }
    }

    await db.collection('student_question_groups').doc(groupId).update({
      data: { updateTime: now }
    })

    return { success: true, addedCount }
  } catch (err) {
    console.error('addQuestionsToStudentGroup error:', err)
    return { success: false, message: err.message }
  }
}
