const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { homeworkId } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  if (!homeworkId) return { success: false, message: '请提供作业ID' }

  try {
    const teacherId = userRes.data[0]._id
    const hwRes = await db.collection('homework').where({ _id: homeworkId, teacherId }).get()
    if (hwRes.data.length === 0) return { success: false, message: '作业不存在或无权操作' }

    const hw = hwRes.data[0]
    if (hw.status === 'withdrawn') return { success: false, message: '作业已撤回，无需重复操作' }

    await db.collection('homework').doc(homeworkId).update({
      data: { status: 'withdrawn' }
    })

    return { success: true }
  } catch (err) {
    console.error('withdrawHomework error:', err)
    return { success: false, message: '撤回失败：' + err.message }
  }
}
