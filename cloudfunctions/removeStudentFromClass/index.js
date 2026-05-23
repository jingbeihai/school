// cloudfunctions/removeStudentFromClass/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { classId, studentId } = event

  if (!classId || !studentId) return { success: false, message: '参数不完整' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const teacher = userRes.data[0]

    const classRes = await db.collection('classes').doc(classId).get()
    if (!classRes.data) return { success: false, message: '班级不存在' }
    if (classRes.data.teacherId !== teacher._id) return { success: false, message: '无权操作他人班级' }

    // 查找并删除
    const existing = await db.collection('class_students')
      .where({ classId, studentId, status: 'active' })
      .get()
    if (!existing.data || existing.data.length === 0) {
      return { success: false, message: '该学生不在班级中' }
    }

    await db.collection('class_students').doc(existing.data[0]._id).update({ data: { status: 'left' } })

    return { success: true }
  } catch (err) {
    console.error('removeStudentFromClass error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
