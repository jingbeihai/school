// cloudfunctions/getClassList/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const teacher = userRes.data[0]

    const classRes = await db.collection('classes')
      .where({ teacherId: teacher._id })
      .orderBy('createTime', 'desc')
      .get()

    // 为每个班级查询学生数量
    const list = await Promise.all(classRes.data.map(async (cls) => {
      const countRes = await db.collection('class_students')
        .where({ classId: cls._id, status: 'active' })
        .count()
      return {
        _id: cls._id,
        name: cls.name,
        teacherId: cls.teacherId,
        teacherName: cls.teacherName,
        inviteCode: cls.inviteCode,
        createTime: cls.createTime,
        status: cls.status,
        studentCount: countRes.total
      }
    }))

    return { success: true, list }
  } catch (err) {
    console.error('getClassList error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
