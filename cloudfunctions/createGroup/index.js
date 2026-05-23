const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { name, description } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }
  if (!name) return { success: false, message: '请输入组名称' }

  try {
    const teacherId = userRes.data[0]._id
    const now = new Date()
    const res = await db.collection('question_groups').add({
      data: {
        teacherId,
        name,
        description: description || '',
        createTime: now,
        updateTime: now
      }
    })
    return { success: true, groupId: res._id }
  } catch (err) {
    console.error('createGroup error:', err)
    return { success: false, message: '创建失败：' + err.message }
  }
}
