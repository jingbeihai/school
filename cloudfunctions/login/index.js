// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-d7gk7ix8d2ebbb913'
})

const db = cloud.database()

/**
 * 生成6位纯数字且全局唯一的 userCode
 */
async function generateUniqueSixDigitCode() {
  const MAX_ATTEMPTS = 20
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = String(Math.floor(Math.random() * 900000) + 100000)
    const existed = await db.collection('users')
      .where({ userCode: code })
      .count()
    if (existed.total === 0) {
      return code
    }
  }
  throw new Error('生成唯一 userCode 失败')
}

/**
 * 登录云函数
 * 输入：{ role, nickName, avatarUrl }
 */
exports.main = async (event, context) => {
  const { role, nickName, avatarUrl } = event

  // 获取 openId
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  // 参数校验
  if (!role) {
    return { success: false, message: '请选择角色' }
  }
  if (!['teacher', 'student', 'parent'].includes(role)) {
    return { success: false, message: '无效的角色类型' }
  }

  try {
    // 查找已注册记录
    const res = await db.collection('users')
      .where({ openId: openId, role: role })
      .get()

    if (res.data && res.data.length > 0) {
      // ===== 老用户 =====
      let record = res.data[0]
      console.log('=== login 老用户 ===')
      console.log('received nickName:', nickName, 'avatarUrl:', avatarUrl)
      console.log('DB nickName:', record.nickName, 'avatarUrl:', record.avatarUrl)
      const updateData = {}

      // VIP 过期检查
      if (record.vipExpireDate && new Date(record.vipExpireDate) < new Date()) {
        updateData.isVip = false
      }

      // 更新昵称
      if (nickName && nickName !== record.nickName) {
        updateData.nickName = nickName
      }

      // 更新头像
      if (avatarUrl && avatarUrl !== record.avatarUrl) {
        updateData.avatarUrl = avatarUrl
      }

      if (Object.keys(updateData).length > 0) {
        await db.collection('users').doc(record._id).update({ data: updateData })
        const updated = await db.collection('users').doc(record._id).get()
        record = updated.data
      }

      return {
        success: true,
        userInfo: {
          _id: record._id,
          openId: record.openId,
          role: record.role,
          nickName: record.nickName || '',
          phone: record.phone || '',
          avatarUrl: record.avatarUrl || '',
          isVip: record.isVip !== false,
          createTime: record.createTime,
          vipExpireDate: record.vipExpireDate,
          status: record.status,
          userCode: record.userCode
        }
      }
    } else {
      // ===== 新用户注册 =====
      const now = new Date()
      const vipExpireDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      const userCode = await generateUniqueSixDigitCode()

      const roleNames = { teacher: '教师', student: '学生', parent: '家长' }
      const newUser = {
        openId: openId,
        role: role,
        nickName: nickName || (roleNames[role] || '用户') + userCode,
        phone: '',
        avatarUrl: avatarUrl || '',
        isVip: true,
        createTime: now,
        vipExpireDate: vipExpireDate,
        status: 'active',
        userCode: userCode
      }

      const addResult = await db.collection('users').add({ data: newUser })

      return {
        success: true,
        userInfo: {
          _id: addResult._id,
          openId: newUser.openId,
          role: newUser.role,
          nickName: newUser.nickName,
          phone: newUser.phone,
          avatarUrl: newUser.avatarUrl,
          isVip: newUser.isVip,
          createTime: now.getTime(),
          vipExpireDate: vipExpireDate.getTime(),
          status: newUser.status,
          userCode: newUser.userCode
        }
      }
    }
  } catch (err) {
    console.error('login error:', err)
    return {
      success: false,
      message: '登录失败: ' + (err.message || '未知错误')
    }
  }
}
