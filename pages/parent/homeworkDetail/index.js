const cloud = require('../../utils/cloud')
// pages/parent/homeworkDetail/index.js
Page({
  data: {
    homeworkId: '',
    studentId: '',
    studentName: '',
    homeworkInfo: {},
    questions: [],
    currentIndex: 0,
    correctCount: 0,
    answeredCount: 0,
    typeLabel: { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', essay: '简答' },
    diffLabel: { easy: '简单', medium: '中等', hard: '困难' }
  },

  onLoad(options) {
    const homeworkId = options.homeworkId || ''
    const studentId = options.studentId || ''
    const studentName = decodeURIComponent(options.studentName || '')
    this.setData({ homeworkId, studentId, studentName })
    this.loadData()
  },

  loadData() {
    wx.showLoading({ title: '加载中...' })
    cloud.callFunction({
      name: 'getParentHomeworkDetail',
      data: {
        homeworkId: this.data.homeworkId,
        studentId: this.data.studentId
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        const questions = this.prepareQuestions(res.result.questions || [])
        this.setData({
          homeworkInfo: res.result.homeworkInfo || {},
          questions,
          currentIndex: 0,
          correctCount: res.result.correctCount || 0,
          answeredCount: res.result.answeredCount || 0,
          studentName: res.result.studentName || this.data.studentName
        })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  prepareQuestions(questions) {
    const choiceTypes = ['single_choice', 'multiple_choice']
    return questions.map(q => {
      if (q.options && q.options.length > 0) {
        q.options = q.options.map((opt, i) => ({
          text: opt,
          letter: String.fromCharCode(65 + i)
        }))
      }
      if (q.type === 'fill_blank' || q.type === 'essay') {
        q.content = (q.content || '').replace(/\\n/g, '\n')
      }
      // 正确答案展示
      if (choiceTypes.includes(q.type) && q.answer) {
        const letters = (q.answer || '').replace(/[^a-zA-Z]/g, '').toUpperCase().split('')
        q.answerDisplay = letters.join(', ')
      }
      // 学生答案展示
      if (choiceTypes.includes(q.type) && q.userAnswer) {
        const letters = (q.userAnswer || '').replace(/[^a-zA-Z]/g, '').toUpperCase().split('')
        q.userAnswerDisplay = letters.join(', ')
      }
      return q
    })
  },

  // 返回
  onBack() {
    wx.navigateBack()
  },

  // 跳转到指定题
  onJumpTo(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    if (!isNaN(index) && index >= 0 && index < this.data.questions.length) {
      this.setData({ currentIndex: index })
    }
  },

  // 上一题
  onPrev() {
    if (this.data.currentIndex > 0) {
      this.setData({ currentIndex: this.data.currentIndex - 1 })
    }
  },

  // 下一题
  onNext() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1 })
    }
  }
})
