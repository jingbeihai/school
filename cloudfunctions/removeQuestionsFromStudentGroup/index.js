// cloudfunctions/removeQuestionsFromStudentGroup/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { groupId, questionIds } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }
  if (!groupId || !questionIds || !questionIds.length) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限' }
    const studentId = userRes.data[0]._id

    const groupRes = await db.collection('student_question_groups')
      .where({ _id: groupId, studentId }).get()
    if (groupRes.data.length === 0) return { success: false, message: '组不存在或无权操作' }

    for (const qId of questionIds) {
      await db.collection('student_group_questions')
        .where({ groupId, questionId: qId }).remove()
    }

    await db.collection('student_question_groups').doc(groupId).update({
      data: { updateTime: new Date() }
    })

    return { success: true }
  } catch (err) {
    console.error('removeQuestionsFromStudentGroup error:', err)
    return { success: false, message: err.message }
  }
}
