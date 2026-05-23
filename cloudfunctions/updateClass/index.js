// cloudfunctions/updateClass/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { classId, name, status } = event

  if (!classId) return { success: false, message: '缺少班级ID' }

  try {
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, message: '无权操作' }
    }
    const teacher = userRes.data[0]

    const classRes = await db.collection('classes').doc(classId).get()
    if (!classRes.data) return { success: false, message: '班级不存在' }
    if (classRes.data.teacherId !== teacher._id) return { success: false, message: '无权修改他人班级' }

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (status !== undefined) updateData.status = status

    if (Object.keys(updateData).length === 0) return { success: false, message: '无修改内容' }

    await db.collection('classes').doc(classId).update({ data: updateData })
    return { success: true }
  } catch (err) {
    console.error('updateClass error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
