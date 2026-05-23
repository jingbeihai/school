const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { groupId, questionIds } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  if (!groupId || !questionIds || !questionIds.length) return { success: false, message: '参数不完整' }

  try {
    const teacherId = userRes.data[0]._id
    const groupRes = await db.collection('question_groups').where({ _id: groupId, teacherId }).get()
    if (groupRes.data.length === 0) return { success: false, message: '收藏组不存在或无权操作' }

    for (const qId of questionIds) {
      await db.collection('group_questions').where({ groupId, questionId: qId }).remove()
    }
    await db.collection('question_groups').doc(groupId).update({ data: { updateTime: new Date() } })
    return { success: true }
  } catch (err) {
    console.error('removeQuestionsFromGroup error:', err)
    return { success: false, message: '操作失败：' + err.message }
  }
}
