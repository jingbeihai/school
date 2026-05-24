const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    console.log('=== getHomeworkForReview Debug ===')
    console.log('openId:', openId)
    console.log('userRes count:', userRes.data.length)
    if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }
    const teacherId = userRes.data[0]._id
    console.log('teacherId:', teacherId)

    // 查询教师发布的所有作业（不用 orderBy 避免依赖复合索引）
    const hwRes = await db.collection('homework')
      .where({ teacherId })
      .get()
    console.log('homework count:', hwRes.data.length)

    // 如果 teacherId 没找到，尝试查全部作业看 teacherId 格式
    if (hwRes.data.length === 0) {
      const allHw = await db.collection('homework').limit(5).get()
      console.log('all homework sample:', JSON.stringify(allHw.data.map(h => ({ 
        _id: h._id, title: h.title, teacherId: h.teacherId, teacherIdType: typeof h.teacherId 
      }))))
    }

    // 在代码中按发布时间倒序排列
    const sorted = hwRes.data.sort((a, b) => {
      const ta = a.publishTime ? new Date(a.publishTime).getTime() : 0
      const tb = b.publishTime ? new Date(b.publishTime).getTime() : 0
      return tb - ta
    })

    const homeworkList = await Promise.all(sorted.map(async (hw) => {
      // 获取班级名称
      let className = ''
      try {
        const cls = await db.collection('classes').doc(hw.classId).get()
        className = cls.data ? cls.data.name : ''
      } catch (e) {}

      // 统计该班级学生总数
      let totalStudents = 0
      try {
        const countRes = await db.collection('class_students')
          .where({ classId: hw.classId, status: 'active' })
          .count()
        totalStudents = countRes.total
      } catch (e) {}

      // 统计已提交学生数
      let submittedCount = 0
      try {
        const subRes = await db.collection('submissions')
          .where({ homeworkId: hw._id, status: 'submitted' })
          .count()
        submittedCount = subRes.total
      } catch (e) {}

      return {
        _id: hw._id,
        title: hw.title,
        classId: hw.classId,
        className,
        publishTime: hw.publishTime,
        deadline: hw.deadline,
        totalStudents,
        submittedCount
      }
    }))

    return { success: true, homeworkList }
  } catch (err) {
    console.error('getHomeworkForReview error:', err)
    return { success: false, message: err.message }
  }
}
