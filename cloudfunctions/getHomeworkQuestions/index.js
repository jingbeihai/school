const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { homeworkId } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  if (!homeworkId) return { success: false, message: '请提供作业ID' }

  try {
    const teacherId = userRes.data[0]._id
    const hwRes = await db.collection('homework').where({ _id: homeworkId, teacherId }).get()
    if (hwRes.data.length === 0) return { success: false, message: '作业不存在或无权操作' }

    const hqRes = await db.collection('homework_questions')
      .where({ homeworkId })
      .orderBy('order', 'asc')
      .get()

    const questionIds = hqRes.data.map(item => item.questionId)
    let questions = []
    if (questionIds.length > 0) {
      const qRes = await db.collection('questions').where({ _id: db.command.in(questionIds) }).get()
      // 按 order 排序
      const qMap = {}
      qRes.data.forEach(q => { qMap[q._id] = q })
      questions = questionIds.map(id => qMap[id]).filter(Boolean)
    }

    return { homework: hwRes.data[0], questions }
  } catch (err) {
    console.error('getHomeworkQuestions error:', err)
    return { homework: null, questions: [] }
  }
}
