const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { groupId } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  if (!groupId) return { success: false, message: '请提供组ID' }

  try {
    const teacherId = userRes.data[0]._id
    const groupRes = await db.collection('question_groups').where({ _id: groupId, teacherId }).get()
    if (groupRes.data.length === 0) return { success: false, message: '收藏组不存在或无权操作' }

    const gqRes = await db.collection('group_questions').where({ groupId }).get()
    const questionIds = gqRes.data.map(item => item.questionId)

    let questions = []
    if (questionIds.length > 0) {
      const qRes = await db.collection('questions').where({ _id: db.command.in(questionIds) }).get()
      questions = qRes.data
    }

    return { group: groupRes.data[0], questions }
  } catch (err) {
    console.error('getGroupQuestions error:', err)
    return { group: null, questions: [] }
  }
}
