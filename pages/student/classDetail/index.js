// pages/student/classDetail/index.js
Page({
  data: {
    classId: '',
    classInfo: {},
    studentList: []
  },
  onLoad(options) {
    this.setData({ classId: options.classId || '' })
    this.loadData()
  },
  loadData() {
    // TODO: 学生端班级详情，后续完善
  }
})
