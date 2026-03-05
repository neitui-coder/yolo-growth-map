App({
  globalData: {
    // 当前登录用户 ID
    currentUserId: 'alex',
    // 当前选中查看的用户 ID
    selectedUserId: 'alex',
    // 已通过密码验证的用户 ID 集合
    editAuthorized: {},
    // 节点类型定义
    NODE_TYPES: {
      activity: { label: 'YOLO+活动', icon: 'people-group', className: 'type-activity' },
      role:     { label: '角色变化', icon: 'user-tie',      className: 'type-role' },
      life:     { label: '人生节点', icon: 'heart',         className: 'type-life' },
      ted:      { label: 'TED分享',  icon: 'microphone',    className: 'type-ted' },
      cert:     { label: '技能认证', icon: 'certificate',   className: 'type-cert' }
    },
    // 头像风格
    AVATAR_STYLES: ['fun-emoji', 'lorelei', 'bottts', 'adventurer-neutral'],
    DEFAULT_AVATAR_STYLE: 'fun-emoji',
    // 用户数据（初始化时生成）
    users: []
  },

  onLaunch: function () {
    // 初始化用户数据
    this.globalData.users = this._generateUsers();
  },

  /**
   * 获取用户数据
   */
  getUser: function (id) {
    return this.globalData.users.find(function (u) { return u.id === id; });
  },

  /**
   * 获取当前选中用户
   */
  getSelectedUser: function () {
    return this.getUser(this.globalData.selectedUserId);
  },

  /**
   * 生成所有用户数据（包含三个核心用户 + 27 个额外用户）
   */
  _generateUsers: function () {
    var coreUsers = [
      {
        id: 'alex', name: 'Alex', motto: '在不确定中寻找确定',
        skills: ['CFA', 'PADI OW'], goal: '2024年完成马拉松',
        joinDate: '2020-06',
        avatarStyle: 'fun-emoji', avatarSeed: 'Alex',
        nodes: [
          { date: '2024-01', type: 'cert', desc: '获得CFA认证', images: [] },
          { date: '2023-09', type: 'ted', desc: 'TED分享《在不确定中寻找确定》', images: [] },
          { date: '2022-05', type: 'life', desc: '结婚', images: [] },
          { date: '2021-03', type: 'role', desc: '担任小组长', images: [] },
          { date: '2020-06', type: 'activity', desc: '加入YOLO+', images: [] }
        ]
      },
      {
        id: 'jenny', name: 'Jenny', motto: '每一步都算数',
        skills: ['PMP'], goal: null,
        joinDate: '2019-09',
        avatarStyle: 'fun-emoji', avatarSeed: 'Jenny',
        nodes: [
          { date: '2023-11', type: 'life', desc: '喜得贵子', images: [] },
          { date: '2022-08', type: 'ted', desc: 'TED分享《在路上》', images: [] },
          { date: '2021-01', type: 'role', desc: '担任主持人', images: [] },
          { date: '2019-09', type: 'activity', desc: '加入YOLO+', images: [] }
        ]
      },
      {
        id: 'sean', name: 'Sean', motto: '做难而正确的事',
        skills: ['AWS SAA'], goal: '学会潜水',
        joinDate: '2021-11',
        avatarStyle: 'fun-emoji', avatarSeed: 'Sean',
        nodes: [
          { date: '2023-06', type: 'life', desc: '买房', images: [] },
          { date: '2022-03', type: 'role', desc: '担任组委', images: [] },
          { date: '2021-11', type: 'activity', desc: '加入YOLO+', images: [] }
        ]
      }
    ];

    var extraUsers = this._generateExtraUsers();
    return coreUsers.concat(extraUsers);
  },

  /**
   * 生成 27 个额外用户
   */
  _generateExtraUsers: function () {
    var EXTRA_NAMES = [
      '李明', '王芳', '张伟', '刘洋', '陈静', '赵磊', '周婷', '吴强',
      '郑慧', '孙涛', '朱丽', '马超', '胡敏', '高峰', '林娜', '何军',
      '罗欣', '梁宇', '谢萍', '韩冰', '唐杰', '曹蕾', '许飞', '邓鑫',
      '冯琳', '蒋波', '沈露'
    ];
    var SKILLS_POOL = ['PMP', 'CPA', 'IELTS 7.5', 'PADI AOW', '茶艺师', 'AWS SAA', '马拉松完赛', '潜水证', '急救证', '烹饪师'];
    var MOTTOS = [
      '保持热爱，奔赴山海', '慢慢来，比较快', '活在当下', '日拱一卒',
      '追光的人终会光芒万丈', '做自己的太阳', '人间值得', '永远好奇',
      '向阳而生', '不负热爱', '认真生活', '勇敢做自己',
      '一步一个脚印', '坚持就是胜利', '心之所向，素履以往',
      '不忘初心', '生活明朗，万物可爱', '温柔且有力量',
      '星光不负赶路人', '努力的人运气不会太差', '脚踏实地仰望星空',
      '每天进步一点点', '用心感受生活', '做最好的自己',
      '愿所得皆所期', '不畏将来不念过往', '越努力越幸运'
    ];
    var ACTIVITY_DESCS = [
      '参加YOLO+年度聚会', '参加户外徒步活动', '组织读书分享会',
      '参加城市探索活动', '参加公益志愿活动'
    ];

    var users = [];
    var baseYear = 2018;

    for (var i = 0; i < 27; i++) {
      var name = EXTRA_NAMES[i];
      var joinYear = baseYear + Math.floor(Math.random() * 5);
      var joinMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      var skills = [SKILLS_POOL[Math.floor(Math.random() * SKILLS_POOL.length)]];
      if (Math.random() > 0.6) {
        var s2 = SKILLS_POOL[Math.floor(Math.random() * SKILLS_POOL.length)];
        if (skills.indexOf(s2) === -1) skills.push(s2);
      }
      var nodes = [{
        date: joinYear + '-' + joinMonth, type: 'activity', desc: '加入YOLO+', images: []
      }];
      if (Math.random() > 0.4) {
        var ny = joinYear + 1 + Math.floor(Math.random() * 2);
        var nm = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        var extraTypes = ['role', 'life', 'ted', 'cert', 'activity'];
        var t = extraTypes[Math.floor(Math.random() * extraTypes.length)];
        var descs = {
          role: '担任活动组织者', life: '完成人生重要里程碑',
          ted: 'TED分享个人成长故事', cert: '获得' + skills[0] + '认证',
          activity: ACTIVITY_DESCS[Math.floor(Math.random() * ACTIVITY_DESCS.length)]
        };
        nodes.unshift({ date: ny + '-' + nm, type: t, desc: descs[t], images: [] });
      }
      users.push({
        id: 'user_' + (i + 4), name: name, motto: MOTTOS[i % MOTTOS.length],
        skills: skills, goal: null, nodes: nodes, joinDate: joinYear + '-' + joinMonth,
        avatarStyle: 'fun-emoji', avatarSeed: name
      });
    }
    return users;
  }
});
