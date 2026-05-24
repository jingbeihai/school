const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { homeworkId, studentId } = event
  if (!homeworkId || !studentId) return { success: false, message: '缺少参数' }

  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }
    const teacherId = userRes.data[0]._id

    // 查询作业
    const hwRes = await db.collection('homework').doc(homeworkId).get()
    if (!hwRes.data) return { success: false, message: '作业不存在' }
    if (hwRes.data.teacherId !== teacherId) return { success: false, message: '无权查看此作业' }

    // 查询提交记录
    const subRes = await db.collection('submissions')
      .where({ homeworkId, studentId })
      .get()

    if (subRes.data.length === 0) {
      return { success: true, empty: true, message: '该学生尚未提交' }
    }

    const submission = subRes.data[0]

    // 查询作业-题目关联（不用 orderBy 避免依赖复合索引）
    const hqRes = await db.collection('homework_questions')
      .where({ homeworkId })
      .get()

    // 按 order 字段排序
    hqRes.data.sort((a, b) => (a.order || 0) - (b.order || 0))

    // 查询题目详情
    const questionIds = hqRes.data.map(hq => hq.questionId)
    let questions = []
    if (questionIds.length > 0) {
      const qRes = await db.collection('questions')
        .where({ _id: db.command.in(questionIds) })
        .get()

      const qMap = {}
      qRes.data.forEach(q => { qMap[q._id] = q })

      // 按 homework_questions 的顺序组装
      questions = hqRes.data.map(hq => {
        const q = qMap[hq.questionId]
        if (!q) return null

        // 找到学生的答案
        const answer = (submission.answers || []).find(a => a.questionId === q._id)

        return {
          questionId: q._id,
          type: q.type,
          content: q.content,
          options: q.options || [],
          answer: q.answer,
          explanation: q.explanation || '',
          userAnswer: answer ? answer.userAnswer : null,
          isCorrect: answer ? answer.isCorrect : false,
          comment: answer ? (answer.comment || '') : ''
        }
      }).filter(Boolean)
    }

    // 获取学生姓名
    let studentName = submission.studentName || ''
    if (!studentName) {
      try {
        const u = await db.collection('users').doc(studentId).get()
        studentName = u.data ? (u.data.name || u.data.nickName || '') : ''
      } catch (e) {}
    }

    return {
      success: true,
      submissionId: submission._id,
      homeworkInfo: {
        _id: hwRes.data._id,
        title: hwRes.data.title,
        deadline: hwRes.data.deadline
      },
      studentName,
      questions,
      correctCount: submission.correctCount || 0,
      totalCount: submission.totalCount || 0,
      teacherComment: submission.teacherComment || ''
    }
  } catch (err) {
    console.error('getStudentHomeworkDetail error:', err)
    return { success: false, message: err.message }
  }
}
