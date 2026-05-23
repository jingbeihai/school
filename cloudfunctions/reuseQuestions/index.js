const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { sourceType, sourceId, targetType, targetId, questionIds, classId } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  const teacherId = userRes.data[0]._id
  if (!questionIds || !questionIds.length) return { success: false, message: '请选择题目' }

  try {
    const now = new Date()

    if (targetType === 'homework') {
      // 发布为新作业
      if (!classId) return { success: false, message: '请选择班级' }
      const classRes = await db.collection('classes').where({ _id: classId, teacherId }).get()
      if (classRes.data.length === 0) return { success: false, message: '班级不存在或无权操作' }

      const className = classRes.data[0].name
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const title = `${dateStr} ${timeStr} ${className}`

      const hwRes = await db.collection('homework').add({
        data: {
          teacherId, classId, title,
          deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          publishTime: now, status: 'active'
        }
      })
      for (let i = 0; i < questionIds.length; i++) {
        await db.collection('homework_questions').add({
          data: { homeworkId: hwRes._id, questionId: questionIds[i], order: i + 1 }
        })
      }

      // 更新 lastUsedTime
      for (const qId of questionIds) {
        await db.collection('questions').doc(qId).update({ data: { lastUsedTime: now } }).catch(() => {})
      }
      return { success: true, homeworkId: hwRes._id }

    } else if (targetType === 'group') {
      // 添加到组
      if (!targetId) return { success: false, message: '请选择目标收藏组' }
      const groupRes = await db.collection('question_groups').where({ _id: targetId, teacherId }).get()
      if (groupRes.data.length === 0) return { success: false, message: '收藏组不存在或无权操作' }

      for (const qId of questionIds) {
        const exist = await db.collection('group_questions').where({ groupId: targetId, questionId: qId }).count()
        if (exist.total === 0) {
          await db.collection('group_questions').add({ data: { groupId: targetId, questionId: qId, addTime: now } })
        }
      }
      await db.collection('question_groups').doc(targetId).update({ data: { updateTime: now } })
      return { success: true }
    }

    return { success: false, message: '未知的目标类型' }
  } catch (err) {
    console.error('reuseQuestions error:', err)
    return { success: false, message: '操作失败：' + err.message }
  }
}
