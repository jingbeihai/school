// 获取家长关联的学生列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 查询家长信息
    const userRes = await db.collection('users').where({ openId: openid, role: 'parent' }).get()
    if (!userRes.data.length) {
      return { success: false, message: '用户不存在' }
    }
    const parentId = userRes.data[0]._id

    // 获取关联的学生列表
    const res = await db.collection('parent_students')
      .where({ parentId })
      .orderBy('createTime', 'desc')
      .get()

    const students = res.data.map(item => ({
      _id: item._id,
      studentId: item.studentId,
      studentName: item.studentName,
      studentCode: item.studentCode,
      createTime: item.createTime
    }))

    return { success: true, students }
  } catch (err) {
    console.error('getParentStudents error:', err)
    return { success: false, message: '获取学生列表失败' }
  }
}
