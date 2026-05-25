const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { homeworkId } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  if (!homeworkId) return { success: false, message: '请提供作业ID' }

  try {
    // 查找用户（教师或学生均可）
    const userRes = await db.collection('users').where({ openId }).get()
    if (userRes.data.length === 0) return { success: false, message: '用户不存在' }

    const user = userRes.data[0]

    // 查询作业
    const hwRes = await db.collection('homework').doc(homeworkId).get()
    if (!hwRes.data) return { success: false, message: '作业不存在' }

    const homework = hwRes.data

    // 权限校验：教师只能看自己的作业，学生只能看自己班级的作业
    if (user.role === 'teacher') {
      if (homework.teacherId !== user._id) {
        return { success: false, message: '无权查看此作业' }
      }
    } else if (user.role === 'student') {
      // 检查学生是否在作业对应班级中
      const csRes = await db.collection('class_students')
        .where({ classId: homework.classId, studentId: user._id })
        .get()
      if (csRes.data.length === 0) {
        return { success: false, message: '你不在该班级中，无权查看此作业' }
      }
    } else {
      return { success: false, message: '角色无权限' }
    }

    // 查询作业-题目关联
    const hqRes = await db.collection('homework_questions')
      .where({ homeworkId })
      .get()

    // 按 order 排序
    hqRes.data.sort((a, b) => (a.order || 0) - (b.order || 0))

    const questionIds = hqRes.data.map(item => item.questionId)
    let questions = []
    const qMap = {}
    if (questionIds.length > 0) {
      const qRes = await db.collection('questions').where({ _id: db.command.in(questionIds) }).get()
      qRes.data.forEach(q => { qMap[q._id] = q })
      // 按 homework_questions 的顺序组装
      questions = hqRes.data.map(hq => {
        const q = qMap[hq.questionId]
        if (!q) return null
        // 学生端不返回答案和解析
        if (user.role === 'student') {
          const { answer, explanation, ...rest } = q
          return rest
        }
        return q
      }).filter(Boolean)
    }

    // 学生端：检查是否有逐题提交的中间状态，并补全正确答案
    let existingAnswers = null
    if (user.role === 'student') {
      const subRes = await db.collection('submissions')
        .where({ homeworkId, studentId: user._id })
        .get()
      if (subRes.data && subRes.data.length > 0) {
        const sub = subRes.data[0]
        if (sub.status === 'submitting') {
          // 从 qMap 中补全每题的正确答案和解析
          existingAnswers = (sub.answers || []).map(a => {
            const q = qMap[a.questionId]
            return {
              questionId: a.questionId,
              userAnswer: a.userAnswer || '',
              isCorrect: a.isCorrect,
              correctAnswer: q ? q.answer || '' : '',
              explanation: q ? q.explanation || '' : ''
            }
          })
        }
      }
    }

    return {
      success: true,
      homeworkInfo: {
        _id: homework._id,
        title: homework.title,
        deadline: homework.deadline,
        classId: homework.classId
      },
      questions,
      existingAnswers
    }
  } catch (err) {
    console.error('getHomeworkQuestions error:', err)
    return { success: false, message: err.message }
  }
}
