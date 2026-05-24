const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

// 将 "2026-05-24T09:38:56 707Z" 等格式化为 "2026-05-24 09:38"
const formatDate = str => {
  if (!str) return ''
  const s = String(str)
  const match = s.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
  return match ? `${match[1]} ${match[2]}` : s
}

module.exports = {
  formatTime,
  formatDate
}
