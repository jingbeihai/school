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
    // 下载云存储文件
    const downloadRes = await cloud.downloadFile({ fileID })
    const fileBuffer = downloadRes.fileContent

    // 使用微信云开发内置的 OCR
    // 调用腾讯云 OCR 通用印刷体识别
    const res = await cloud.openapi.ocr.printedText({
      type: 'photo',
      imgUrl: fileID
    }).catch(async () => {
      // 如果 openapi 不可用，返回 mock 数据提示需手动配置
      return null
    })

    if (res && res.items) {
      const text = res.items.map(item => item.text).join('\n')
      return { success: true, text }
    }

    // 备选：返回提示信息
    return {
      success: true,
      text: 'OCR识别功能需要配置腾讯云OCR服务。\n请确保已在云开发控制台开通OCR接口权限。\n当前为占位文本，请手动输入或通过AI出题。',
      needManual: true
    }
  } catch (err) {
    console.error('ocrImage error:', err)
    return { success: false, message: '图片识别失败：' + (err.message || '未知错误') }
  }
}
