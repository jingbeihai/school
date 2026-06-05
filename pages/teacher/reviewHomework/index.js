const cloud = require('../../utils/cloud')
const { formatDate } = require('../../../utils/util.js')

Page({
  data: {
    homeworkId: '',
    homework: null,
    students: [],
    filteredStudents: [],
    searchKey: '',
    loading: false
  },

  onLoad(options) {
    this.setData({ homeworkId: options.homeworkId })
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    wx.showLoading({ title: '加载中...' })
    cloud.callFunction({
      name: 'getHomeworkStudentsProgress',
      data: { homeworkId: this.data.homeworkId }
    }).then(res => {
      wx.hideLoading()
      const r = res.result
      if (r.success) {
        const hw = { ...r.homework, deadline: formatDate(r.homework.deadline) }
        this.setData({
          homework: hw,
          students: r.students,
          filteredStudents: r.students,
          loading: false
        })
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: r.message || '加载失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false })
      console.error(err)
    })
  },

  onSearch(e) {
    const key = (e.detail.value || '').trim().toLowerCase()
    this.setData({ searchKey: key })
    if (!key) {
      this.setData({ filteredStudents: this.data.students })
      return
    }
    const filtered = this.data.students.filter(s =>
      s.name.toLowerCase().includes(key) || s.userCode.toLowerCase().includes(key)
    )
    this.setData({ filteredStudents: filtered })
  },

  goDetail(e) {
    const student = e.currentTarget.dataset.student
    if (student && student.status === 'answered') {
      wx.navigateTo({
        url: `/pages/teacher/reviewStudent/index?homeworkId=${this.data.homeworkId}&studentId=${student.studentId}`
      })
    }
  }
})
