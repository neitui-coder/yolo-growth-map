var app = getApp();

// 12 张预置照片
var SAMPLE_PHOTOS = [
  { id: 1, url: 'https://picsum.photos/seed/yolo1/200', label: '活动合影' },
  { id: 2, url: 'https://picsum.photos/seed/yolo2/200', label: '舞台' },
  { id: 3, url: 'https://picsum.photos/seed/yolo3/200', label: '户外' },
  { id: 4, url: 'https://picsum.photos/seed/yolo4/200', label: '聚餐' },
  { id: 5, url: 'https://picsum.photos/seed/yolo5/200', label: '证书' },
  { id: 6, url: 'https://picsum.photos/seed/yolo6/200', label: '旅行' },
  { id: 7, url: 'https://picsum.photos/seed/yolo7/200', label: '庆祝' },
  { id: 8, url: 'https://picsum.photos/seed/yolo8/200', label: '团建' },
  { id: 9, url: 'https://picsum.photos/seed/wedding1/200', label: '婚礼' },
  { id: 10, url: 'https://picsum.photos/seed/baby1/200', label: '宝宝' },
  { id: 11, url: 'https://picsum.photos/seed/house1/200', label: '新家' },
  { id: 12, url: 'https://picsum.photos/seed/diving1/200', label: '潜水' }
];

Page({
  /**
   * 编辑页面 - 添加/编辑成长节点
   * URL 参数:
   *   userId: 用户ID
   *   nodeIndex: 节点索引（不传则为新增模式）
   */
  data: {
    isEdit: false,
    userId: '',
    nodeIndex: -1,
    // 表单数据
    date: '',
    typeIndex: 0,
    typeOptions: ['YOLO+活动', '角色变化', '人生节点', 'TED分享', '技能认证'],
    typeKeys: ['activity', 'role', 'life', 'ted', 'cert'],
    desc: '',
    images: [],
    // 照片选择
    samplePhotos: [],
    selectedPhotos: []
  },

  onLoad: function (options) {
    var userId = options.userId || app.globalData.selectedUserId;
    var nodeIndex = options.nodeIndex !== undefined ? parseInt(options.nodeIndex) : -1;
    var isEdit = nodeIndex >= 0;

    this.setData({ userId: userId, nodeIndex: nodeIndex, isEdit: isEdit });

    if (isEdit) {
      var user = app.getUser(userId);
      var node = user.nodes[nodeIndex];
      var typeIdx = this.data.typeKeys.indexOf(node.type);
      var existingImages = node.images || [];
      this.setData({
        date: node.date,
        typeIndex: typeIdx >= 0 ? typeIdx : 0,
        desc: node.desc,
        images: existingImages
      });
      wx.setNavigationBarTitle({ title: '编辑成长节点' });
    } else {
      wx.setNavigationBarTitle({ title: '添加成长节点' });
    }

    this._initPhotoGrid();
  },

  /**
   * 初始化照片网格，标记已选中的照片
   */
  _initPhotoGrid: function () {
    var images = this.data.images;
    var samplePhotos = SAMPLE_PHOTOS.map(function (p) {
      return {
        id: p.id,
        url: p.url,
        label: p.label,
        selected: images.indexOf(p.url) >= 0
      };
    });
    var selectedPhotos = images.map(function (url) {
      return { url: url };
    });
    this.setData({
      samplePhotos: samplePhotos,
      selectedPhotos: selectedPhotos
    });
  },

  onDateChange: function (e) {
    this.setData({ date: e.detail.value });
  },

  onTypeChange: function (e) {
    this.setData({ typeIndex: parseInt(e.detail.value) });
  },

  onDescInput: function (e) {
    this.setData({ desc: e.detail.value });
  },

  /**
   * 切换照片选中状态
   */
  onTogglePhoto: function (e) {
    var index = e.currentTarget.dataset.index;
    var photo = this.data.samplePhotos[index];
    var selectedPhotos = this.data.selectedPhotos.slice();
    var samplePhotos = this.data.samplePhotos.slice();

    if (photo.selected) {
      // 取消选中
      samplePhotos[index] = Object.assign({}, photo, { selected: false });
      selectedPhotos = selectedPhotos.filter(function (p) { return p.url !== photo.url; });
    } else {
      // 选中 - 如果已满3张，移除最早的一张
      if (selectedPhotos.length >= 3) {
        var removedUrl = selectedPhotos[0].url;
        selectedPhotos.shift();
        // 在 samplePhotos 中取消标记
        for (var i = 0; i < samplePhotos.length; i++) {
          if (samplePhotos[i].url === removedUrl) {
            samplePhotos[i] = Object.assign({}, samplePhotos[i], { selected: false });
            break;
          }
        }
      }
      samplePhotos[index] = Object.assign({}, photo, { selected: true });
      selectedPhotos.push({ url: photo.url });
    }

    var images = selectedPhotos.map(function (p) { return p.url; });
    this.setData({
      samplePhotos: samplePhotos,
      selectedPhotos: selectedPhotos,
      images: images
    });
  },

  /**
   * 移除已选照片
   */
  onRemovePhoto: function (e) {
    var removeIndex = e.currentTarget.dataset.index;
    var removedUrl = this.data.selectedPhotos[removeIndex].url;
    var selectedPhotos = this.data.selectedPhotos.slice();
    selectedPhotos.splice(removeIndex, 1);

    // 在 samplePhotos 中取消标记
    var samplePhotos = this.data.samplePhotos.slice();
    for (var i = 0; i < samplePhotos.length; i++) {
      if (samplePhotos[i].url === removedUrl) {
        samplePhotos[i] = Object.assign({}, samplePhotos[i], { selected: false });
        break;
      }
    }

    var images = selectedPhotos.map(function (p) { return p.url; });
    this.setData({
      samplePhotos: samplePhotos,
      selectedPhotos: selectedPhotos,
      images: images
    });
  },

  onSubmit: function () {
    var date = this.data.date;
    var desc = this.data.desc.trim();

    if (!date || !desc) {
      wx.showToast({ title: '请填写日期和内容', icon: 'error' });
      return;
    }

    var user = app.getUser(this.data.userId);
    var typeKey = this.data.typeKeys[this.data.typeIndex];
    var nodeData = {
      date: date,
      type: typeKey,
      desc: desc,
      images: this.data.images
    };

    if (this.data.isEdit) {
      user.nodes[this.data.nodeIndex] = nodeData;
    } else {
      user.nodes.unshift(nodeData);
    }

    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(function () {
      wx.navigateBack();
    }, 800);
  }
});
