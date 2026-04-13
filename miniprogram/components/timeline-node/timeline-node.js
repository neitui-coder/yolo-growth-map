var util = require('../../utils/util.js');

function humanizeKey(key) {
  return String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join('、');
  if (typeof value === 'object') {
    return value.text || value.label || value.name || value.title || JSON.stringify(value);
  }
  return String(value);
}

function buildActivityMeta(node) {
  var raw = node.activityMeta || node.activityParticipation || node.participationMeta ||
    node.participation || node.activityInfo || node.activityDetails;
  var items = [];

  function pushItem(label, value) {
    var text = stringifyValue(value).trim();
    if (text) items.push({ label: label, value: text });
  }

  if (!raw) {
    ['activityRole', 'participationRole', 'participationStatus', 'participationLevel', 'host', 'organizer', 'team', 'badge', 'note'].forEach(function (key) {
      if (node[key] !== undefined && node[key] !== null && node[key] !== '') {
        pushItem(humanizeKey(key), node[key]);
      }
    });
  } else if (typeof raw === 'string') {
    pushItem('参与信息', raw);
  } else if (Array.isArray(raw)) {
    raw.slice(0, 3).forEach(function (entry, idx) {
      if (entry && typeof entry === 'object') {
        pushItem(entry.label || entry.name || ('信息' + (idx + 1)), entry.value || entry.text || entry);
      } else {
        pushItem('参与信息', entry);
      }
    });
  } else if (typeof raw === 'object') {
    var preferredKeys = ['role', 'position', 'status', 'level', 'team', 'host', 'organizer', 'attendance', 'hours', 'score', 'note', 'summary'];
    preferredKeys.forEach(function (key) {
      if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
        pushItem(humanizeKey(key), raw[key]);
      }
    });

    if (!items.length) {
      Object.keys(raw).slice(0, 3).forEach(function (key) {
        if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
          pushItem(humanizeKey(key), raw[key]);
        }
      });
    }
  }

  if (!items.length) {
    ['participationText', 'activityText', 'participationNote'].forEach(function (key) {
      if (node[key]) pushItem('参与信息', node[key]);
    });
  }

  return items.slice(0, 3);
}

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
    },
    // 视图变体: 'modern'(默认) | 'minimal'
    variant: {
      type: String,
      value: 'modern'
    }
  },

  data: {
    formattedDate: '',
    isOdd: false,
    activityMetaItems: [],
    hasActivityMeta: false,
    participantAvatars: [],
    participantCount: 0,
    extraParticipantCount: 0,
    hasParticipants: false
  },

  observers: {
    'node, index': function (node, index) {
      if (!node) return;
      var activityMetaItems = node.type === 'activity' ? buildActivityMeta(node) : [];

      this.setData({
        formattedDate: node.date ? util.formatDate(node.date) : '',
        isOdd: index % 2 === 0,
        activityMetaItems: activityMetaItems,
        hasActivityMeta: activityMetaItems.length > 0,
        participantAvatars: node.activityParticipants || [],
        participantCount: node.participantCount || 0,
        extraParticipantCount: node.extraParticipantCount || 0,
        hasParticipants: !!(node.activityParticipants && node.activityParticipants.length)
      });
    }
  },

  methods: {
    onNodeTap: function () {
      var node = this.properties.node;
      // 传递原始节点索引 _idx（由 index 页面排序时设置）
      var originalIndex = node._idx !== undefined ? node._idx : this.properties.index;
      this.triggerEvent('nodetap', { index: originalIndex });
    },

    onImageTap: function (e) {
      var displayImages =
        (this.properties.node && this.properties.node.displayImages) ||
        (this.properties.node && this.properties.node.images) ||
        [];
      this.triggerEvent('imagetap', {
        images: displayImages,
        index: Number(e.currentTarget.dataset.index || 0)
      });
    }
  }
});
