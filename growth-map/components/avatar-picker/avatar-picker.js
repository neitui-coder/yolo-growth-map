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
      value: 'fun-emoji'
    },
    // 当前用户的头像种子
    currentSeed: {
      type: String,
      value: ''
    }
  },

  data: {
    avatarChoices: []
  },

  observers: {
    'visible': function (visible) {
      if (visible) {
        this._generateChoices();
      }
    }
  },

  methods: {
    _generateChoices: function () {
      var styles = ['fun-emoji', 'lorelei', 'bottts', 'adventurer-neutral'];
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

    onOverlayTap: function () {
      this.triggerEvent('close');
    },

    onContentTap: function () {
      // 阻止事件冒泡到 overlay
    }
  }
});
