// cloudfunctions/getStudentHomeworkList/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    // 验证学生身份
    const userRes = await db.collection('users').where({ openId, role: 'student' }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '无权操作' }
    const student = userRes.data[0]

    // 获取学生加入的班级
    const relationRes = await db.collection('class_students')
      .where({ studentId: student._id, status: 'active' })
      .get()

    if (!relationRes.data || relationRes.data.length === 0) {
      return { success: true, list: [] }
    }

    const classIds = relationRes.data.map(r => r.classId)

    // 获取这些班级的作业（active + withdrawn 都显示）
    const homeworkRes = await db.collection('homework')
      .where({ classId: _.in(classIds), status: 'active' })
      .orderBy('publishTime', 'desc')
      .get()

    if (!homeworkRes.data || homeworkRes.data.length === 0) {
      return { success: true, list: [] }
    }

    // 查询班级信息（获取班级名）
    const classMap = {}
    const classRes = await db.collection('classes')
      .where({ _id: _.in(classIds) })
      .get()
    classRes.data.forEach(c => { classMap[c._id] = c.name })

    // 查询学生的提交记录
    const homeworkIds = homeworkRes.data.map(h => h._id)
    const submissionRes = await db.collection('submissions')
      .where({ homeworkId: _.in(homeworkIds), studentId: student._id })
      .get()

    const submissionMap = {}
    submissionRes.data.forEach(s => {
      submissionMap[s.homeworkId] = {
        submitTime: s.submitTime,
        correctCount: s.correctCount,
        totalCount: s.totalCount
      }
    })

    // 组装列表
    const list = homeworkRes.data.map(hw => {
      const sub = submissionMap[hw._id]
      return {
        _id: hw._id,
        title: hw.title,
        classId: hw.classId,
        className: classMap[hw.classId] || '',
        publishTime: hw.publishTime,
        deadline: hw.deadline,
        status: hw.status,
        submitted: !!sub,
        correctCount: sub ? sub.correctCount : 0,
        totalCount: sub ? sub.totalCount : 0,
        submitTime: sub ? sub.submitTime : null
      }
    })

    return { success: true, list }
  } catch (err) {
    console.error('getStudentHomeworkList error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
