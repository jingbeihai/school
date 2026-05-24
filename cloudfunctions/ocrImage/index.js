const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { fileID } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  if (!fileID) return { success: false, message: '请提供图片文件ID' }

  try {
    // 调用微信云开发内置 OCR 通用印刷体识别
    const res = await cloud.openapi.ocr.printedText({
      type: 'photo',
      imgUrl: fileID
    })

    if (res && res.items && res.items.length > 0) {
      const text = res.items.map(item => item.text).join('\n')
      return { success: true, text }
    }

    return { success: false, message: '图片中未识别到文字，请确保图片清晰' }
  } catch (err) {
    console.error('ocrImage error:', err)
    const errCode = err.errCode || err.code || ''
    if (errCode === -604011) {
      return { success: false, message: 'OCR接口未开通，请在微信云开发控制台 → 云函数 → ocrImage → 开通OCR权限' }
    }
    return { success: false, message: '图片识别失败：' + (err.message || '未知错误') }
  }
}
