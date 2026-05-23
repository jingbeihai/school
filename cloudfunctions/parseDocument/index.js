const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { fileID, fileType } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { success: false, message: '未获取到用户身份' }

  const userRes = await db.collection('users').where({ openId, role: 'teacher' }).get()
  if (userRes.data.length === 0) return { success: false, message: '无权限，仅教师可操作' }

  if (!fileID) return { success: false, message: '请提供文件ID' }

  try {
    const downloadRes = await cloud.downloadFile({ fileID })
    let text = ''

    const type = (fileType || '').toLowerCase()
    if (type === 'txt') {
      text = downloadRes.fileContent.toString('utf-8')
    } else if (type === 'doc' || type === 'docx') {
      // 微信云函数环境暂不支持解析 doc/docx，提示使用其他方式
      text = '暂不支持 doc/docx 解析，请使用 txt 或 pdf 格式，或将内容粘贴到文本框中使用。'
    } else if (type === 'pdf') {
      // pdf-parse 需要引入，这里先用占位
      text = 'PDF解析需要引入 pdf-parse 库。请确保云函数已安装依赖。当前为占位文本，请将内容粘贴到文本框中使用。'
    } else {
      text = downloadRes.fileContent.toString('utf-8')
    }

    return { success: true, text }
  } catch (err) {
    console.error('parseDocument error:', err)
    return { success: false, message: '文件解析失败：' + (err.message || '未知错误') }
  }
}
