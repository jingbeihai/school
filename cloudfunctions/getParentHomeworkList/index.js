// 家长端查看关联学生的作业列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 查询家长信息
    const parentRes = await db.collection('users').where({ openId: openid, role: 'parent' }).get()
    if (!parentRes.data.length) {
      return { success: false, message: '用户不存在' }
    }
    const parentId = parentRes.data[0]._id

    // 获取关联的所有学生
    const linkRes = await db.collection('parent_students').where({ parentId }).get()
    if (!linkRes.data.length) {
      return { success: true, list: [] }
    }

    const studentIds = linkRes.data.map(s => s.studentId)
    const studentMap = {}
    linkRes.data.forEach(l => { studentMap[l.studentId] = l.studentName || '学生' })

    // 获取这些学生加入的班级
    const csRes = await db.collection('class_students').where({
      studentId: _.in(studentIds),
      status: 'active'
    }).get()

    if (!csRes.data.length) {
      return { success: true, list: [] }
    }

    const classIds = [...new Set(csRes.data.map(cs => cs.classId))]

    // 查询班级名称
    const classMap = {}
    const classRes = await db.collection('classes')
      .where({ _id: _.in(classIds) })
      .get()
    classRes.data.forEach(c => { classMap[c._id] = c.name })

    // 从 homework 集合查询作业
    const homeworkRes = await db.collection('homework')
      .where({ classId: _.in(classIds), status: 'active' })
      .orderBy('publishTime', 'desc')
      .get()

    if (!homeworkRes.data || homeworkRes.data.length === 0) {
      return { success: true, list: [] }
    }

    // 获取每份作业的实际题目数
    const homeworkIds = homeworkRes.data.map(h => h._id)
    const hqRes = await db.collection('homework_questions')
      .where({ homeworkId: _.in(homeworkIds) })
      .get()
    const questionCountMap = {}
    hqRes.data.forEach(hq => {
      questionCountMap[hq.homeworkId] = (questionCountMap[hq.homeworkId] || 0) + 1
    })

    // 查询提交记录，检测是否有新评语
    const submissions = await db.collection('submissions')
      .where({ homeworkId: _.in(homeworkIds), studentId: _.in(studentIds) })
      .field({ homeworkId: true, studentId: true, hasNewComment: true })
      .get()
    const newCommentMap = {}
    submissions.data.forEach(s => {
      newCommentMap[`${s.homeworkId}_${s.studentId}`] = !!s.hasNewComment
    })

    // 按学生展开：同一作业，多个关联学生则展示多条
    const list = []
    homeworkRes.data.forEach(hw => {
      const studentsInClass = csRes.data.filter(cs => cs.classId === hw.classId)
      studentsInClass.forEach(cs => {
        const key = `${hw._id}_${cs.studentId}`
        list.push({
          _id: hw._id,
          studentId: cs.studentId,
          studentName: studentMap[cs.studentId] || '',
          title: hw.title,
          className: classMap[hw.classId] || '',
          publishTime: hw.publishTime,
          deadline: hw.deadline,
          totalCount: questionCountMap[hw._id] || 0,
          hasNewComment: newCommentMap[key] || false
        })
      })
    })

    return { success: true, list }
  } catch (err) {
    console.error('getParentHomeworkList error:', err)
    return { success: false, message: '获取作业列表失败' }
  }
}
