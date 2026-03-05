var util = require('../../utils/util.js');

Component({
  /**
   * timeline-node: 时间轴单个节点
   * 显示日期、类型标签、描述文字、图片缩略图
   * 根据节点类型（activity/role/life/ted/cert）显示不同颜色
   * 奇偶交替左右排列
   */
  properties: {
    // 节点数据 { date, type, desc, images }
    node: {
      type: Object,
      value: {}
    },
    // 节点在数组中的索引
    index: {
      type: Number,
      value: 0
    },
    // 节点类型配置
    typeConfig: {
      type: Object,
      value: {}
    }
  },

  data: {
    formattedDate: '',
    isOdd: false
  },

  observers: {
    'node, index': function (node, index) {
      if (node && node.date) {
        this.setData({
          formattedDate: util.formatDate(node.date),
          isOdd: index % 2 === 0
        });
      }
    }
  },

  methods: {
    onNodeTap: function () {
      var node = this.properties.node;
      // 传递原始节点索引 _idx（由 index 页面排序时设置）
      var originalIndex = node._idx !== undefined ? node._idx : this.properties.index;
      this.triggerEvent('nodetap', { index: originalIndex });
    }
  }
});
