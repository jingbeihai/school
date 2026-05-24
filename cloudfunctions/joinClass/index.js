// cloudfunctions/joinClass/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { inviteCode } = event

  if (!inviteCode) return { success: false, message: '请输入邀请码' }

  try {
    // 验证学生身份
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, message: '仅学生身份可以加入班级' }
    }
    const student = userRes.data[0]

    // 根据邀请码查找班级
    const classRes = await db.collection('classes').where({ inviteCode: inviteCode.toUpperCase(), status: 'active' }).get()
    if (!classRes.data || classRes.data.length === 0) {
      return { success: false, message: '邀请码无效，请检查后重试' }
    }
    const cls = classRes.data[0]

    // 检查是否已加入该班级
    const existRes = await db.collection('class_students').where({
      classId: cls._id,
      studentId: student._id,
      status: 'active'
    }).get()
    if (existRes.data && existRes.data.length > 0) {
      return { success: false, message: '你已加入该班级，无需重复加入' }
    }

    // 加入班级
    await db.collection('class_students').add({
      data: {
        classId: cls._id,
        studentId: student._id,
        studentName: student.nickName || '学生',
        joinTime: new Date(),
        status: 'active'
      }
    })

    return {
      success: true,
      classInfo: {
        _id: cls._id,
        name: cls.name,
        teacherName: cls.teacherName
      }
    }
  } catch (err) {
    console.error('joinClass error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
