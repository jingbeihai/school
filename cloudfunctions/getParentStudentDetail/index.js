// 获取学生详情及其加入的班级列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { relationId, studentId } = event

  try {
    // 查询家长信息
    const parentRes = await db.collection('users').where({ openId: openid, role: 'parent' }).get()
    if (!parentRes.data.length) {
      return { success: false, message: '用户不存在' }
    }
    const parentId = parentRes.data[0]._id

    // 验证关联关系
    const linkRes = await db.collection('parent_students').where({
      _id: relationId,
      parentId,
      studentId
    }).get()
    if (!linkRes.data.length) {
      return { success: false, message: '未找到关联记录' }
    }
    const link = linkRes.data[0]

    // 获取学生信息
    const studentRes = await db.collection('users').doc(studentId).get()
    const studentInfo = studentRes.data ? {
      nickName: studentRes.data.nickName || '',
      userCode: studentRes.data.userCode || '',
      avatarUrl: studentRes.data.avatarUrl || '',
      phone: studentRes.data.phone || ''
    } : {}

    // 获取学生加入的班级关系
    const csRes = await db.collection('class_students').where({
      studentId,
      status: 'active'
    }).get()

    const classList = []
    for (const cs of csRes.data) {
      try {
        const classRes = await db.collection('classes').doc(cs.classId).get()
        if (classRes.data) {
          // 查询班级人数
          const countRes = await db.collection('class_students').where({
            classId: cs.classId,
            status: 'active'
          }).count()
          classList.push({
            _id: classRes.data._id,
            name: classRes.data.name,
            inviteCode: classRes.data.inviteCode,
            studentCount: countRes.total,
            joinTime: cs.createTime
          })
        }
      } catch (e) {
        // 班级可能已被删除，跳过
      }
    }

    return {
      success: true,
      studentInfo: {
        ...studentInfo,
        relationId: link._id,
        createTime: link.createTime
      },
      classList
    }
  } catch (err) {
    console.error('getParentStudentDetail error:', err)
    return { success: false, message: '获取学生详情失败' }
  }
}
