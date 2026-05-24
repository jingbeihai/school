const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { classId, questionIds, deadline, title: customTitle } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  const teacherId = userRes.data[0]._id
  if (!classId || !questionIds || !questionIds.length) return { success: false, message: '参数不完整' }

  try {
    // 获取班级名称
    const classRes = await db.collection('classes').where({ _id: classId, teacherId }).get()
    if (classRes.data.length === 0) return { success: false, message: '班级不存在或无权操作' }

    const className = classRes.data[0].name
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const title = `${dateStr} ${className}` + (customTitle && customTitle.trim() ? ` ${customTitle.trim()}` : '')

    // 计算截止时间（默认7天后）
    let dl = deadline ? new Date(deadline) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const homeworkRes = await db.collection('homework').add({
      data: {
        teacherId,
        classId,
        title,
        deadline: dl,
        publishTime: now,
        status: 'active'
      }
    })
    const homeworkId = homeworkRes._id

    // 添加题目关联
    for (let i = 0; i < questionIds.length; i++) {
      await db.collection('homework_questions').add({
        data: {
          homeworkId,
          questionId: questionIds[i],
          order: i + 1
        }
      })
    }

    // 更新题目的 lastUsedTime
    for (const qId of questionIds) {
      await db.collection('questions').doc(qId).update({
        data: { lastUsedTime: now }
      }).catch(() => {})
    }

    // 自动创建收藏组
    try {
      const groupRes = await db.collection('question_groups').add({
        data: {
          teacherId,
          name: title,
          description: `作业"${title}"的题目`,
          createTime: now,
          updateTime: now
        }
      })
      for (const qId of questionIds) {
        await db.collection('group_questions').add({
          data: { groupId: groupRes._id, questionId: qId, addTime: now }
        })
      }
    } catch (e) { /* 不阻塞主流程 */ }

    return { success: true, homeworkId }
  } catch (err) {
    console.error('publishHomework error:', err)
    return { success: false, message: '发布失败：' + err.message }
  }
}
