// 家长关联学生（通过6位识别码）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { code } = event

  if (!code || code.length !== 6) {
    return { success: false, message: '请输入6位识别码' }
  }

  try {
    // 先通过识别码查找学生
    const studentRes = await db.collection('users').where({ userCode: code, role: 'student' }).get()
    if (!studentRes.data.length) {
      return { success: false, message: '学生账号不存在，请检查识别码' }
    }
    const student = studentRes.data[0]

    // 查询家长信息（login 函数存的字段是 openId）
    const parentRes = await db.collection('users').where({ openId: openid, role: 'parent' }).get()
    if (!parentRes.data.length) {
      return { success: false, message: '关联失败，请重新登录后重试' }
    }
    const parentId = parentRes.data[0]._id

    // 检查是否已关联
    const existRes = await db.collection('parent_students').where({
      parentId,
      studentId: student._id
    }).get()
    if (existRes.data.length) {
      return { success: false, message: '已关联该学生，无需重复关联' }
    }

    // 创建关联
    await db.collection('parent_students').add({
      data: {
        parentId,
        parentOpenid: openid,
        studentId: student._id,
        studentName: student.nickName || '学生',
        studentCode: student.userCode,
        createTime: db.serverDate()
      }
    })

    return { success: true, message: '关联成功' }
  } catch (err) {
    console.error('linkStudent error:', err)
    return { success: false, message: '关联失败: ' + (err.message || '未知错误') }
  }
}
