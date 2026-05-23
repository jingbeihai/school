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

  if (!groupId || !questionIds || !questionIds.length) return { success: false, message: '请选择题目' }

  try {
    const teacherId = userRes.data[0]._id
    // 验证组属于当前教师
    const groupRes = await db.collection('question_groups').where({ _id: groupId, teacherId }).get()
    if (groupRes.data.length === 0) return { success: false, message: '收藏组不存在或无权操作' }

    const now = new Date()
    // 批量添加，忽略已存在的
    for (const qId of questionIds) {
      const exist = await db.collection('group_questions').where({ groupId, questionId: qId }).count()
      if (exist.total === 0) {
        await db.collection('group_questions').add({
          data: { groupId, questionId: qId, addTime: now }
        })
      }
    }
    // 更新组时间
    await db.collection('question_groups').doc(groupId).update({ data: { updateTime: now } })

    return { success: true }
  } catch (err) {
    console.error('addQuestionsToGroup error:', err)
    return { success: false, message: '操作失败：' + err.message }
  }
}
