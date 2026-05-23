// cloudfunctions/getClassDetail/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { classId } = event

  if (!classId) return { success: false, message: '缺少班级ID' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const teacher = userRes.data[0]

    const classRes = await db.collection('classes').doc(classId).get()
    if (!classRes.data) return { success: false, message: '班级不存在' }
    if (classRes.data.teacherId !== teacher._id) return { success: false, message: '无权查看他人班级' }

    const cls = classRes.data

    // 获取学生列表
    const studentsRes = await db.collection('class_students')
      .where({ classId, status: 'active' })
      .get()

    // 联查学生详细信息
    const students = await Promise.all(studentsRes.data.map(async (cs) => {
      try {
        const studentRes = await db.collection('users').doc(cs.studentId).get()
        const student = studentRes.data
        // 查找该学生的家长
        let parentName = '未绑定'
        try {
          const parentRes = await db.collection('class_students')
            .where({ studentId: cs.studentId, status: 'active' })
            .get()
          // 这里简化：暂不实现完整的家长关联，直接返回学生信息
        } catch (e) { /* ignore */ }
        return {
          _id: cs._id,
          studentId: cs.studentId,
          studentName: student.nickName || '学生',
          userCode: student.userCode || '',
          avatarUrl: student.avatarUrl || '',
          phone: student.phone || '',
          isVip: student.isVip,
          joinTime: cs.joinTime,
          parentName: student.parentName || '未绑定'
        }
      } catch (e) {
        return { _id: cs._id, studentId: cs.studentId, studentName: '未知学生', joinTime: cs.joinTime, parentName: '未绑定' }
      }
    }))

    return {
      success: true,
      classInfo: {
        _id: cls._id,
        name: cls.name,
        teacherId: cls.teacherId,
        teacherName: cls.teacherName,
        inviteCode: cls.inviteCode,
        createTime: cls.createTime,
        status: cls.status,
        studentCount: students.length
      },
      students
    }
  } catch (err) {
    console.error('getClassDetail error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
