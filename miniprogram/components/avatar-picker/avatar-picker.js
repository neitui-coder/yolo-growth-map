Component({
  /**
   * avatar-picker: 头像选择弹窗
   * 展示 4x4 网格头像选项（来自 DiceBear 不同风格和种子）
   * 点击选择后触发 avatarselect 事件
   * 显示/隐藏通过 visible 属性控制
   */
  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false
    },
    // 当前用户的头像风格
    currentStyle: {
      type: String,
      value: 'adventurer-neutral'
    },
    // 当前用户的头像种子
    currentSeed: {
      type: String,
      value: ''
    },
    // 用于上传头像时拼云存储路径
    userId: {
      type: String,
      value: ''
    }
  },

  data: {
    avatarChoices: [],
    uploading: false
  },

  // 已改为"仅上传照片"，不再生成预设(DiceBear)头像

  methods: {
    _generateChoices: function () {
      var styles = getApp().globalData.AVATAR_STYLES;
      var seeds = [
        'happy', 'sunshine', 'star', 'moon', 'rainbow', 'flower', 'cloud', 'wave',
        'heart', 'smile', 'lucky', 'dream', 'bliss', 'joy', 'hope', 'peace'
      ];
      var choices = [];
      for (var i = 0; i < styles.length; i++) {
        for (var j = 0; j < seeds.length; j++) {
          choices.push({ style: styles[i], seed: seeds[j] });
        }
      }
      // 随机取 16 个
      choices.sort(function () { return Math.random() - 0.5; });
      choices = choices.slice(0, 16);
      var currentStyle = this.properties.currentStyle;
      var currentSeed = this.properties.currentSeed;
      choices = choices.map(function (c) {
        var url = 'https://api.dicebear.com/7.x/' + c.style + '/svg?seed=' + encodeURIComponent(c.seed) + '&size=64';
        return {
          style: c.style,
          seed: c.seed,
          url: url,
          isCurrent: c.style === currentStyle && c.seed === currentSeed
        };
      });
      this.setData({ avatarChoices: choices });
    },

    onAvatarTap: function (e) {
      var style = e.currentTarget.dataset.style;
      var seed = e.currentTarget.dataset.seed;
      this.triggerEvent('avatarselect', { style: style, seed: seed });
    },

    // 上传自己的照片作为头像：选图 -> 上传云存储 -> 把 fileID 抛给页面保存
    onUploadPhoto: function () {
      var that = this;
      if (this.data.uploading) return;
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: function (res) {
          var file = res.tempFiles && res.tempFiles[0];
          if (!file || !file.tempFilePath) return;
          that.setData({ uploading: true });
          wx.showLoading({ title: '上传中...' });
          var uid = that.properties.userId || 'user';
          var ext = (file.tempFilePath.match(/\.(\w+)$/) || [])[1] || 'jpg';
          var cloudPath = 'yolo-growth-map/media/avatars/uploads/' + uid + '-' + Date.now() + '.' + ext;
          wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: file.tempFilePath,
            success: function (up) {
              wx.hideLoading();
              that.setData({ uploading: false });
              if (up.fileID) {
                that.triggerEvent('avatarupload', { avatarImage: up.fileID });
              } else {
                wx.showToast({ title: '上传失败', icon: 'none' });
              }
            },
            fail: function () {
              wx.hideLoading();
              that.setData({ uploading: false });
              wx.showToast({ title: '上传失败，请重试', icon: 'none' });
            }
          });
        }
      });
    },

    onOverlayTap: function () {
      this.triggerEvent('close');
    },

    onContentTap: function () {
      // 阻止事件冒泡到 overlay
    }
  }
});
