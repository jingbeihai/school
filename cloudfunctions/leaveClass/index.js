// cloudfunctions/leaveClass/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { classId } = event

  if (!classId) return { success: false, message: '参数不完整' }

  try {
    // 验证学生身份
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const student = userRes.data[0]

    // 查找该学生在班级中的记录
    const existing = await db.collection('class_students')
      .where({ classId, studentId: student._id, status: 'active' })
      .get()
    if (!existing.data || existing.data.length === 0) {
      return { success: false, message: '你不在该班级中' }
    }

    // 软删除：标记为 left
    await db.collection('class_students').doc(existing.data[0]._id).update({ data: { status: 'left' } })

    return { success: true }
  } catch (err) {
    console.error('leaveClass error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
