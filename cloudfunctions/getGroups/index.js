const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  try {
    const teacherId = userRes.data[0]._id
    const groupsRes = await db.collection('question_groups')
      .where({ teacherId })
      .orderBy('updateTime', 'desc')
      .get()

    // 统计每个组的题目数
    const groups = []
    for (const g of groupsRes.data) {
      const countRes = await db.collection('group_questions').where({ groupId: g._id }).count()
      groups.push({ ...g, questionCount: countRes.total })
    }
    return { groups }
  } catch (err) {
    console.error('getGroups error:', err)
    return { groups: [] }
  }
}
