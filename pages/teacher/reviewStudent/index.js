Page({
  data: {
    homeworkId: '',
    studentId: '',
    submissionId: '',
    homeworkInfo: null,
    studentName: '',
    questions: [],
    correctCount: 0,
    totalCount: 0,
    teacherComment: '',
    questionComments: {},
    saving: false
  },

  onLoad(options) {
    this.setData({
      homeworkId: options.homeworkId,
      studentId: options.studentId
    })
    this.loadData()
  },

  loadData() {
    wx.showLoading({ title: '加载中...' })
    wx.cloud.callFunction({
      name: 'getStudentHomeworkDetail',
      data: {
        homeworkId: this.data.homeworkId,
        studentId: this.data.studentId
      }
    }).then(res => {
      wx.hideLoading()
      const r = res.result
      if (!r.success) {
        wx.showToast({ title: r.message, icon: 'none' })
        return
      }
      if (r.empty) {
        wx.showToast({ title: '学生未提交', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }
      const qComments = {}
      r.questions.forEach(q => { qComments[q.questionId] = q.comment || '' })
      this.setData({
        submissionId: r.submissionId,
        homeworkInfo: r.homeworkInfo,
        studentName: r.studentName,
        questions: r.questions,
        correctCount: r.correctCount,
        totalCount: r.totalCount,
        teacherComment: r.teacherComment || '',
        questionComments: qComments
      })
    }).catch(err => {
      wx.hideLoading()
      console.error(err)
    })
  },

  onQuestionComment(e) {
    const qId = e.currentTarget.dataset.qid
    const val = e.detail.value
    const qComments = this.data.questionComments
    qComments[qId] = val
    this.setData({ questionComments: qComments })
  },

  onTeacherComment(e) {
    this.setData({ teacherComment: e.detail.value })
  },

  async saveAllComments() {
    const { submissionId, questionComments, teacherComment, saving } = this.data
    if (saving) return
    if (!submissionId) return

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      // 批量保存单题评语
      for (const qId in questionComments) {
        await wx.cloud.callFunction({
          name: 'saveComment',
          data: {
            submissionId,
            questionId: qId,
            comment: questionComments[qId]
          }
        })
      }

      // 保存整体评语
      await wx.cloud.callFunction({
        name: 'saveComment',
        data: {
          submissionId,
          comment: teacherComment
        }
      })

      wx.hideLoading()
      wx.showToast({ title: '评语已保存', icon: 'success' })
      this.setData({ saving: false })
    } catch (err) {
      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
