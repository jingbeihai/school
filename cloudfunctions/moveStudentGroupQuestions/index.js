// cloudfunctions/moveStudentGroupQuestions/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { fromGroupId, toGroupId, questionIds } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }
  if (!fromGroupId || !toGroupId || !questionIds || !questionIds.length) {
    return { success: false, message: '参数不完整' }
  }
  if (fromGroupId === toGroupId) return { success: false, message: '不能移动到同一个组' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限' }
    const studentId = userRes.data[0]._id

    // 验证两个组都存在且属于该学生
    const fromRes = await db.collection('student_question_groups')
      .where({ _id: fromGroupId, studentId }).get()
    if (fromRes.data.length === 0) return { success: false, message: '源组不存在或无权操作' }

    const toRes = await db.collection('student_question_groups')
      .where({ _id: toGroupId, studentId }).get()
    if (toRes.data.length === 0) return { success: false, message: '目标组不存在或无权操作' }

    const now = new Date()

    for (const qId of questionIds) {
      // 获取原关联数据
      const existing = await db.collection('student_group_questions')
        .where({ groupId: fromGroupId, questionId: qId }).get()

      // 在目标组中创建（如果不存在）
      const existInTarget = await db.collection('student_group_questions')
        .where({ groupId: toGroupId, questionId: qId }).count()
      if (existInTarget.total === 0 && existing.data.length > 0) {
        const src = existing.data[0]
        await db.collection('student_group_questions').add({
          data: {
            groupId: toGroupId,
            questionId: qId,
            addTime: now,
            sourceHomeworkId: src.sourceHomeworkId || '',
            userAnswer: src.userAnswer || '',
            correctAnswer: src.correctAnswer || ''
          }
        })
      }

      // 从源组删除
      await db.collection('student_group_questions')
        .where({ groupId: fromGroupId, questionId: qId }).remove()
    }

    await db.collection('student_question_groups').doc(fromGroupId).update({
      data: { updateTime: now }
    })
    await db.collection('student_question_groups').doc(toGroupId).update({
      data: { updateTime: now }
    })

    return { success: true }
  } catch (err) {
    console.error('moveStudentGroupQuestions error:', err)
    return { success: false, message: err.message }
  }
}
