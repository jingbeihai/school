// cloudfunctions/createStudentGroup/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { name, type } = event  // type: 'collection' | 'error'
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }
  if (!name) return { success: false, message: '请输入名称' }
  if (!type || !['collection', 'error'].includes(type)) {
    return { success: false, message: '类型无效' }
  }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限' }
    const studentId = userRes.data[0]._id

    // 重名检查（集合可能尚未创建）
    let dupRes = { data: [] }
    try {
      dupRes = await db.collection('student_question_groups')
        .where({ studentId, name, type })
        .get()
    } catch (e) {
      // 集合不存在，忽略
    }
    if (dupRes.data.length > 0) {
      return { success: false, message: '已存在同名' + (type === 'collection' ? '收藏组' : '错题本') }
    }

    const now = new Date()
    const res = await db.collection('student_question_groups').add({
      data: { studentId, name, type, description: '', createTime: now, updateTime: now }
    })
    return { success: true, groupId: res._id }
  } catch (err) {
    console.error('createStudentGroup error:', err)
    return { success: false, message: '创建失败：' + err.message }
  }
}
