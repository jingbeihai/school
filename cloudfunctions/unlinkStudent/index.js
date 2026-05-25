// 家长解除学生关联
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { relationId } = event

  try {
    // 查询家长信息
    const parentRes = await db.collection('users').where({ openId: openid, role: 'parent' }).get()
    if (!parentRes.data.length) {
      return { success: false, message: '用户不存在' }
    }
    const parentId = parentRes.data[0]._id

    // 删除关联记录
    const res = await db.collection('parent_students').where({
      _id: relationId,
      parentId
    }).remove()

    if (res.stats.removed > 0) {
      return { success: true, message: '已解除关联' }
    }
    return { success: false, message: '解除关联失败' }
  } catch (err) {
    console.error('unlinkStudent error:', err)
    return { success: false, message: '解除关联失败' }
  }
}
