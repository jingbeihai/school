// cloudfunctions/updateUserProfile/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { nickName, phone } = event

  try {
    const userRes = await db.collection('users').where({ openId }).get()
    if (!userRes.data || userRes.data.length === 0) return { success: false, message: '用户不存在' }

    const user = userRes.data[0]
    const updateData = {}
    if (nickName !== undefined) updateData.nickName = nickName
    if (phone !== undefined) updateData.phone = phone

    if (Object.keys(updateData).length === 0) return { success: false, message: '无修改内容' }

    await db.collection('users').doc(user._id).update({ data: updateData })

    // 如果是教师，同步更新 classes 中的 teacherName
    if (user.role === 'teacher' && nickName) {
      await db.collection('classes').where({ teacherId: user._id }).update({
        data: { teacherName: nickName }
      })
    }

    // 返回更新后的用户信息
    const updated = await db.collection('users').doc(user._id).get()
    return {
      success: true,
      userInfo: {
        _id: updated.data._id,
        openId: updated.data.openId,
        role: updated.data.role,
        nickName: updated.data.nickName || '',
        phone: updated.data.phone || '',
        avatarUrl: updated.data.avatarUrl || '',
        isVip: updated.data.isVip,
        vipExpireDate: updated.data.vipExpireDate,
        status: updated.data.status,
        userCode: updated.data.userCode
      }
    }
  } catch (err) {
    console.error('updateUserProfile error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
