// 家长端查看关联学生的作业列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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

    // 获取这些学生加入的班级
    const csRes = await db.collection('class_students').where({
      studentId: db.command.in(studentIds),
      status: 'active'
    }).get()

    if (!csRes.data.length) {
      return { success: true, list: [] }
    }

    const classIds = [...new Set(csRes.data.map(cs => cs.classId))]

    // 获取班级和对应的作业
    const homeworkList = []
    for (const classId of classIds) {
      try {
        const classRes = await db.collection('classes').doc(classId).get()
        if (!classRes.data) continue

        const hwRes = await db.collection('homework_questions').where({
          classId,
          status: db.command.neq('deleted')
        }).orderBy('publishTime', 'desc').get()

        for (const hw of hwRes.data) {
          homeworkList.push({
            _id: hw._id,
            title: hw.title,
            className: classRes.data.name,
            publishTime: hw.publishTime,
            deadline: hw.deadline,
            totalCount: (hw.questions || []).length
          })
        }
      } catch (e) {
        // skip errors
      }
    }

    // 按发布时间倒序
    homeworkList.sort((a, b) => {
      const tA = a.publishTime ? new Date(a.publishTime).getTime() : 0
      const tB = b.publishTime ? new Date(b.publishTime).getTime() : 0
      return tB - tA
    })

    return { success: true, list: homeworkList }
  } catch (err) {
    console.error('getParentHomeworkList error:', err)
    return { success: false, message: '获取作业列表失败' }
  }
}
