// cloudfunctions/getStudentDetail/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { studentId, classId } = event

  if (!studentId) return { success: false, message: '缺少学生ID' }

  try {
    // 验证教师身份
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const teacher = userRes.data[0]

    // 如果传了 classId，验证该班级属于此教师
    if (classId) {
      const classRes = await db.collection('classes').doc(classId).get()
      if (!classRes.data) return { success: false, message: '班级不存在' }
      if (classRes.data.teacherId !== teacher._id) return { success: false, message: '无权查看' }
    }

    const studentRes = await db.collection('users').doc(studentId).get()
    if (!studentRes.data) return { success: false, message: '学生不存在' }

    const student = studentRes.data

    // 查找关联家长（简化：暂从 users 中查找，未来可扩展）
    let parents = []
    try {
      const parentRes = await db.collection('users')
        .where({ role: 'parent', status: 'active' })
        .get()
      // 简化：暂不实现完整关联，返回空
    } catch (e) { /* ignore */ }

    return {
      success: true,
      student: {
        _id: student._id,
        nickName: student.nickName || '',
        phone: student.phone || '',
        avatarUrl: student.avatarUrl || '',
        userCode: student.userCode || '',
        isVip: student.isVip,
        status: student.status,
        parents
      }
    }
  } catch (err) {
    console.error('getStudentDetail error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
