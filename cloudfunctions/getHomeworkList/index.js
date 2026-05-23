const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  try {
    const teacherId = userRes.data[0]._id
    const hwRes = await db.collection('homework')
      .where({ teacherId })
      .orderBy('publishTime', 'desc')
      .get()

    // 联查班级名称和题目数
    const homeworkList = []
    for (const hw of hwRes.data) {
      let className = ''
      try {
        const clsRes = await db.collection('classes').doc(hw.classId).get()
        className = clsRes.data?.name || ''
      } catch (e) {}

      const qCount = await db.collection('homework_questions').where({ homeworkId: hw._id }).count()
      homeworkList.push({ ...hw, className, questionCount: qCount.total })
    }
    return { homeworkList }
  } catch (err) {
    console.error('getHomeworkList error:', err)
    return { homeworkList: [] }
  }
}
