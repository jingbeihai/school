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
    const userRes = await db.collection('users').where({ openId }).get()
    if (userRes.data.length === 0) return { success: false, message: '用户不存在' }
    const user = userRes.data[0]

    // 查询作业
    const hwRes = await db.collection('homework').doc(homeworkId).get()
    if (!hwRes.data) return { success: false, message: '作业不存在' }

    // 权限校验：教师只能看自己的作业，学生只能看自己的提交
    if (user.role === 'teacher') {
      if (hwRes.data.teacherId !== user._id) {
        return { success: false, message: '无权查看此作业' }
      }
    } else if (user.role === 'student') {
      // 学生只能查看自己的提交
      if (studentId !== user._id) {
        return { success: false, message: '无权查看他人的提交' }
      }
    } else {
      return { success: false, message: '角色无权限' }
    }

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
          _id: q._id,
          questionId: q._id,
          type: q.type,
          content: q.content,
          options: q.options || [],
          answer: q.answer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          userAnswer: answer ? answer.userAnswer : null,
          isCorrect: answer ? !!answer.isCorrect : false,
          hasSubmitted: !!answer,
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

    // 清除新评语标记（学生已查看）
    if (submission && submission.hasNewComment) {
      await db.collection('submissions').doc(submission._id).update({
        data: { hasNewComment: false }
      })
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
