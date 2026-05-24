// cloudfunctions/getStudentGroups/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { type } = event  // 'collection' | 'error' | undefined(全部)
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限' }
    const studentId = userRes.data[0]._id

    const where = { studentId }
    if (type) where.type = type

    // 集合可能尚未创建，静默返回空列表
    let groupsRes
    try {
      groupsRes = await db.collection('student_question_groups')
        .where(where)
        .orderBy('updateTime', 'desc')
        .get()
    } catch (e) {
      // 集合不存在则返回空
      if (e.errCode === -502005 || e.message.includes('not exist')) {
        return { success: true, groups: [] }
      }
      throw e
    }

    const groups = []
    for (const g of groupsRes.data) {
      try {
        const countRes = await db.collection('student_group_questions')
          .where({ groupId: g._id })
          .count()
        groups.push({ ...g, questionCount: countRes.total })
      } catch (e) {
        groups.push({ ...g, questionCount: 0 })
      }
    }

    return { success: true, groups }
  } catch (err) {
    console.error('getStudentGroups error:', err)
    return { success: false, message: err.message }
  }
}
