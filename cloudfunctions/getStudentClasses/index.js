// cloudfunctions/getStudentClasses/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    // 验证学生身份
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const student = userRes.data[0]

    // 获取学生加入的班级关系
    const relationRes = await db.collection('class_students')
      .where({ studentId: student._id, status: 'active' })
      .get()

    if (!relationRes.data || relationRes.data.length === 0) {
      return { success: true, list: [] }
    }

    // 获取班级信息
    const classIds = relationRes.data.map(r => r.classId)
    const classRes = await db.collection('classes')
      .where({ _id: _.in(classIds) })
      .orderBy('createTime', 'desc')
      .get()

    // 为每个班级查询学生数量，同时获取当前学生的 joinTime
    const list = await Promise.all(classRes.data.map(async (cls) => {
      const countRes = await db.collection('class_students')
        .where({ classId: cls._id, status: 'active' })
        .count()

      // 获取当前学生的加入时间
      const relation = relationRes.data.find(r => r.classId === cls._id)
      const joinTime = relation ? relation.joinTime : null

      return {
        _id: cls._id,
        name: cls.name,
        teacherId: cls.teacherId,
        teacherName: cls.teacherName,
        inviteCode: cls.inviteCode,
        createTime: cls.createTime,
        status: cls.status,
        studentCount: countRes.total,
        joinTime: joinTime
      }
    }))

    return { success: true, list }
  } catch (err) {
    console.error('getStudentClasses error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
