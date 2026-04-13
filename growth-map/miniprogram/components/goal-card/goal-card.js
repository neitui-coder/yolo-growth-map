Component({
  /**
   * goal-card: 年度目标卡片
   * 如果用户有目标 → 显示黄色渐变目标卡片
   * 如果没有目标 → 显示虚线框"设定年度目标"按钮
   */
  properties: {
    // 目标文本，null 或空字符串表示未设定
    goal: {
      type: String,
      value: ''
    }
  },

  data: {},

  methods: {
    onSetGoal: function () {
      this.triggerEvent('setgoal');
    }
  }
});
