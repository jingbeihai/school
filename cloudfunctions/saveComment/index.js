const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { submissionId, questionId, comment } = event
  if (!submissionId) return { success: false, message: '缺少提交ID' }

  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

    // 获取提交记录
    const subRes = await db.collection('submissions').doc(submissionId).get()
    if (!subRes.data) return { success: false, message: '提交记录不存在' }

    const updateData = { reviewedAt: db.serverDate() }

    if (questionId) {
      // 保存单题评语：更新 answers 数组中对应题目的 comment
      const answers = subRes.data.answers || []
      const idx = answers.findIndex(a => a.questionId === questionId)
      if (idx === -1) return { success: false, message: '题目不存在' }

      answers[idx].comment = comment || ''
      updateData.answers = answers
    } else {
      // 保存整体评语（保留兼容）
      updateData.teacherComment = comment || ''
    }

    // 标记为有新评语，学生端可看到提醒
    updateData.hasNewComment = true
    await db.collection('submissions').doc(submissionId).update({ data: updateData })

    return { success: true }
  } catch (err) {
    console.error('saveComment error:', err)
    return { success: false, message: err.message }
  }
}
