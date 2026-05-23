// cloudfunctions/createClass/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' })
const db = cloud.database()
const _ = db.command

// 生成唯一邀请码：1个大写字母(A-H,J-N,P-R,T-Y) + 5位数字(1-9)
const ALLOWED_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXY'
const ALLOWED_DIGITS = '123456789'

function generateInviteCode() {
  const letter = ALLOWED_LETTERS[Math.floor(Math.random() * ALLOWED_LETTERS.length)]
  let digits = ''
  for (let i = 0; i < 5; i++) {
    digits += ALLOWED_DIGITS[Math.floor(Math.random() * ALLOWED_DIGITS.length)]
  }
  return letter + digits
}

async function getUniqueInviteCode() {
  for (let i = 0; i < 20; i++) {
    const code = generateInviteCode()
    const res = await db.collection('classes').where({ inviteCode: code }).count()
    if (res.total === 0) return code
  }
  throw new Error('生成邀请码失败')
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { name, inviteCode } = event

  if (!name) return { success: false, message: '请输入班级名称' }

  try {
    // 验证教师身份
    const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, message: '仅有教师身份可以创建班级' }
    }
    const teacher = userRes.data[0]

    // 生成邀请码
    const code = inviteCode ? inviteCode : await getUniqueInviteCode()

    const classData = {
      name,
      teacherId: teacher._id,
      teacherName: teacher.nickName || '教师',
      inviteCode: code,
      createTime: new Date(),
      status: 'active'
    }

    const result = await db.collection('classes').add({ data: classData })

    return {
      success: true,
      classInfo: { _id: result._id, ...classData, createTime: classData.createTime.getTime() }
    }
  } catch (err) {
    console.error('createClass error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
}
