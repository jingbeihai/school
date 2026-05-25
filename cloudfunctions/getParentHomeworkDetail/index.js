// 家长端查看作业详情（含学生作答情况）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { homeworkId, studentId } = event

  if (!homeworkId) return { success: false, message: '缺少作业ID' }
  if (!studentId) return { success: false, message: '缺少学生ID' }

  try {
    // 查询家长信息
    const parentRes = await db.collection('users').where({ openId: openid, role: 'parent' }).get()
    if (!parentRes.data.length) return { success: false, message: '用户不存在' }
    const parentId = parentRes.data[0]._id

    // 验证该学生是否属于当前家长
    const linkRes = await db.collection('parent_students').where({
      parentId,
      studentId
    }).get()
    if (!linkRes.data.length) return { success: false, message: '该学生未与您关联' }

    // 查询作业
    const hwRes = await db.collection('homework').doc(homeworkId).get()
    if (!hwRes.data) return { success: false, message: '作业不存在' }
    const homework = hwRes.data

    // 验证学生是否在作业所在班级中
    const csRes = await db.collection('class_students').where({
      classId: homework.classId,
      studentId,
      status: 'active'
    }).get()
    if (!csRes.data.length) {
      return { success: false, message: '该学生不在作业所属班级中' }
    }

    // 获取班级名
    const classRes = await db.collection('classes').doc(homework.classId).get()
    const className = classRes.data ? classRes.data.name : ''

    // 查询作业-题目关联
    const hqRes = await db.collection('homework_questions')
      .where({ homeworkId })
      .get()
    hqRes.data.sort((a, b) => (a.order || 0) - (b.order || 0))

    const questionIds = hqRes.data.map(item => item.questionId)

    // 查询所有题目
    let qMap = {}
    if (questionIds.length > 0) {
      const qRes = await db.collection('questions').where({ _id: db.command.in(questionIds) }).get()
      qRes.data.forEach(q => { qMap[q._id] = q })
    }

    // 查询该学生的提交记录
    const subRes = await db.collection('submissions')
      .where({ homeworkId, studentId })
      .get()
    const submission = subRes.data.length > 0 ? subRes.data[0] : null

    // 构建学生答案映射
    const answerMap = {}
    if (submission && submission.answers) {
      submission.answers.forEach(a => { answerMap[a.questionId] = a })
    }

    const studentName = linkRes.data[0].studentName || '学生'

    // 组装题目列表（含学生作答）
    let questions = hqRes.data.map(hq => {
      const q = qMap[hq.questionId]
      if (!q) return null
      const ans = answerMap[q._id]
      return {
        _id: q._id,
        type: q.type,
        content: q.content,
        options: q.options || [],
        answer: q.answer,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        // 学生作答
        userAnswer: ans ? ans.userAnswer : null,
        isCorrect: ans ? !!ans.isCorrect : null,
        hasSubmitted: !!ans
      }
    }).filter(Boolean)

    const answeredCount = questions.filter(q => q.hasSubmitted).length
    const correctCount = questions.filter(q => q.isCorrect === true).length

    return {
      success: true,
      studentName,
      homeworkInfo: {
        _id: homework._id,
        title: homework.title,
        className,
        deadline: homework.deadline,
        publishTime: homework.publishTime,
        totalCount: questions.length
      },
      questions,
      answeredCount,
      correctCount
    }
  } catch (err) {
    console.error('getParentHomeworkDetail error:', err)
    return { success: false, message: '获取作业详情失败' }
  }
}
