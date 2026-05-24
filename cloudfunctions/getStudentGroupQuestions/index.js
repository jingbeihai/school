// cloudfunctions/getStudentGroupQuestions/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { groupId } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }
  if (!groupId) return { success: false, message: '请提供组ID' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限' }
    const studentId = userRes.data[0]._id

    const groupRes = await db.collection('student_question_groups')
      .where({ _id: groupId, studentId }).get()
    if (groupRes.data.length === 0) return { success: false, message: '不存在或无权操作' }

    const group = groupRes.data[0]

    // 集合可能尚未创建，静默返回空
    let gqRes = { data: [] }
    try {
      gqRes = await db.collection('student_group_questions')
        .where({ groupId })
        .orderBy('addTime', 'desc')
        .get()
    } catch (e) {
      // 集合不存在，返回空题目列表
    }

    const questionIds = gqRes.data.map(item => item.questionId)
    let questions = []
    if (questionIds.length > 0) {
      const qRes = await db.collection('questions')
        .where({ _id: db.command.in(questionIds) })
        .get()

      const qMap = {}
      qRes.data.forEach(q => { qMap[q._id] = q })

      // 附加学生的作答信息和来源
      questions = gqRes.data.map(gq => {
        const q = qMap[gq.questionId]
        if (!q) return null
        return {
          ...q,
          _gqId: gq._id,
          sourceHomeworkId: gq.sourceHomeworkId || '',
          userAnswer: gq.userAnswer || '',
          correctAnswer: gq.correctAnswer || ''
        }
      }).filter(Boolean)
    }

    return { success: true, group, questions }
  } catch (err) {
    console.error('getStudentGroupQuestions error:', err)
    return { success: false, message: err.message }
  }
}
