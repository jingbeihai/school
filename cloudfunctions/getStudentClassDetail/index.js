// cloudfunctions/getStudentClassDetail/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { classId } = event

  if (!classId) return { success: false, message: '缺少班级ID' }

  try {
    // 验证学生身份
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const student = userRes.data[0]

    // 获取班级信息
    const classRes = await db.collection('classes').doc(classId).get()
    if (!classRes.data) return { success: false, message: '班级不存在' }

    const cls = classRes.data

    // 获取当前学生的加入记录
    const relRes = await db.collection('class_students')
      .where({ classId, studentId: student._id, status: 'active' })
      .get()
    if (!relRes.data || relRes.data.length === 0) {
      return { success: false, message: '你不在该班级中' }
    }
    const joinTime = relRes.data[0].joinTime

    // 获取学生总人数
    const countRes = await db.collection('class_students')
      .where({ classId, status: 'active' })
      .count()

    // 获取教师信息
    let teacherInfo = { teacherId: cls.teacherId, teacherName: cls.teacherName || '未知', phone: '', userCode: '' }
    try {
      const teacherRes = await db.collection('users').doc(cls.teacherId).get()
      if (teacherRes.data) {
        teacherInfo = {
          teacherId: cls.teacherId,
          teacherName: teacherRes.data.nickName || cls.teacherName || '未知',
          phone: teacherRes.data.phone || '',
          userCode: teacherRes.data.userCode || '',
          avatarUrl: teacherRes.data.avatarUrl || ''
        }
      }
    } catch (e) {
      // 教师可能已注销，使用 class 中冗余的 teacherName
    }

    return {
      success: true,
      classInfo: {
        _id: cls._id,
        name: cls.name,
        teacherId: cls.teacherId,
        teacherName: teacherInfo.teacherName,
        inviteCode: cls.inviteCode,
        createTime: cls.createTime,
        status: cls.status,
        studentCount: countRes.total,
        joinTime: joinTime
      },
      teacherInfo
    }
  } catch (err) {
    console.error('getStudentClassDetail error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
