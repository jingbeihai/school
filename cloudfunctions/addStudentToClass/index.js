// cloudfunctions/addStudentToClass/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { classId, userCode } = event

  if (!classId || !userCode) return { success: false, message: '参数不完整' }

  try {
    // 验证教师
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const teacher = userRes.data[0]

    // 验证班级属于该教师
    const classRes = await db.collection('classes').doc(classId).get()
    if (!classRes.data) return { success: false, message: '班级不存在' }
    if (classRes.data.teacherId !== teacher._id) return { success: false, message: '无权操作他人班级' }

    // 通过 userCode 查找学生
    const studentRes = await db.collection('users')
      .where({ userCode, role: 'student' })
      .get()
    if (!studentRes.data || studentRes.data.length === 0) {
      return { success: false, message: '未找到该学生，请检查编号' }
    }
    const student = studentRes.data[0]

    // 检查是否已在班级中
    const existing = await db.collection('class_students')
      .where({ classId, studentId: student._id, status: 'active' })
      .count()
    if (existing.total > 0) {
      return { success: false, message: '该学生已在班级中' }
    }

    await db.collection('class_students').add({
      data: {
        classId,
        studentId: student._id,
        studentName: student.nickName || '学生',
        joinTime: new Date(),
        status: 'active'
      }
    })

    return { success: true }
  } catch (err) {
    console.error('addStudentToClass error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
