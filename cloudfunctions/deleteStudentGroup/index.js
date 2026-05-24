// cloudfunctions/deleteStudentGroup/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { groupId } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }
  if (!groupId) return { success: false, message: '请提供组ID' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限' }
    const studentId = userRes.data[0]._id

    const groupRes = await db.collection('student_question_groups')
      .where({ _id: groupId, studentId }).get()
    if (groupRes.data.length === 0) return { success: false, message: '不存在或无权操作' }

    // 删除组内题目关联
    await db.collection('student_group_questions').where({ groupId }).remove()
    // 删除组本身
    await db.collection('student_question_groups').doc(groupId).remove()
    return { success: true }
  } catch (err) {
    console.error('deleteStudentGroup error:', err)
    return { success: false, message: '删除失败：' + err.message }
  }
}
