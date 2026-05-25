const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { homeworkId } = event
  if (!homeworkId) return { success: false, message: '缺少作业ID' }

  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }
    const teacherId = userRes.data[0]._id

    // 查询作业信息
    const hwRes = await db.collection('homework').doc(homeworkId).get()
    if (!hwRes.data) return { success: false, message: '作业不存在' }
    if (hwRes.data.teacherId !== teacherId) return { success: false, message: '无权查看此作业' }

    const classId = hwRes.data.classId

    // 获取班级所有活跃学生
    const studentRes = await db.collection('class_students')
      .where({ classId, status: 'active' })
      .get()

    // 获取该班级名称
    let className = ''
    try {
      const cls = await db.collection('classes').doc(classId).get()
      className = cls.data ? cls.data.name : ''
    } catch (e) {}

    // 获取所有提交记录（answers 非空即算已作答）
    const submissions = await db.collection('submissions')
      .where({ homeworkId })
      .field({ studentId: true, answers: true, correctCount: true, totalCount: true, submitTime: true })
      .get()

    const submissionMap = {}
    submissions.data.forEach(s => { submissionMap[s.studentId] = s })

    const students = await Promise.all(studentRes.data.map(async (cs) => {
      const uid = cs.studentId
      let userName = ''
      let userCode = ''
      try {
        const u = await db.collection('users').doc(uid).get()
        if (u.data) {
          userName = u.data.name || u.data.nickName || ''
          userCode = u.data.userCode || u.data.studentId || ''
        }
      } catch (e) {}

      const sub = submissionMap[uid]
      if (sub && sub.answers && sub.answers.length > 0) {
        return {
          studentId: uid,
          name: userName || '未知',
          userCode,
          status: 'answered',
          correctCount: sub.correctCount || 0,
          totalCount: sub.totalCount || 0,
          answeredCount: sub.answers.length,
          correctRate: sub.totalCount ? Math.round((sub.correctCount / sub.totalCount) * 100) : 0,
          submitTime: sub.submitTime
        }
      }
      return {
        studentId: uid,
        name: userName || '未知',
        userCode,
        status: 'not_answered',
        correctCount: 0,
        totalCount: 0,
        answeredCount: 0,
        correctRate: 0,
        submitTime: null
      }
    }))

    return {
      success: true,
      homework: { _id: hwRes.data._id, title: hwRes.data.title, className, deadline: hwRes.data.deadline },
      students
    }
  } catch (err) {
    console.error('getHomeworkStudentsProgress error:', err)
    return { success: false, message: err.message }
  }
}
