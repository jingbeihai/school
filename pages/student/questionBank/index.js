// pages/student/questionBank/index.js
Page({
  data: {},
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabs()
    }
  }
})
