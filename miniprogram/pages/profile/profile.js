var util = require("../../utils/util.js");
var app = getApp();
var AI_FUNNY_INTRO_VERSION = 3;

// "和TA最像"的理由：优先展示有缘分感的（都喜欢同一首歌/书/游戏、共同爱好），
// 而不是冷冰冰的"同为某 MBTI"。带 emoji，取最戳人的两条。
function serendipityReason(reasons) {
  if (!reasons || !reasons.length) return "志趣相投";
  // 按缘分感排序（都喜欢>都想去>都爱>盖洛普>城市>MBTI），纯文字、不带 emoji
  var ORDER = ["都喜欢", "都想去", "都爱", "同有", "都在", "同为"];
  function rank(r) {
    for (var i = 0; i < ORDER.length; i++) { if (r.indexOf(ORDER[i]) === 0) return i; }
    return 9;
  }
  var sorted = reasons.slice().sort(function (a, b) { return rank(a) - rank(b); });
  return sorted.slice(0, 2).join(" · ");
}

Page({
  data: {
    pageLoading: true,
    userId: "",
    selectedUser: {},
    isOwner: false,
    canEditProfile: false,
    canManageProfile: false,
    canEditOthers: false,
    sortedNodes: [],
    nodeTypes: {},
    showAvatarPicker: false,
    hasProfileInfo: false,
    hasDetailInfo: false,
    profileDetailExpanded: false,
    favoritesExpanded: false,
    showGrowthModal: false,
    growthTotal: 0,
    growthRows: [],
    selectedUserQa: [],
    qaVisibleCount: 0,
    qaEmptyText: "",
    heroMotto: "",
    funnyIntro: "",
    funnyIntroOptions: [],
    funnyIntroVariantIndex: 0,
    funnyIntroSourceLabel: "",
    funnyIntroIsAi: true,
    funnyIntroRefreshing: false,
    canRefreshFunnyIntro: false,
    canAutoGenerateFunnyIntro: false,
    imageViewerVisible: false,
    viewerImages: [],
    viewerIndex: 0,
    completeness: 100,
    missingFieldsText: "",
    similarUsers: [],
    similarityTitle: "和你最像的会员",
    similarUsersTitle: "和你最像的会员",
    similarUsersHint: "",
    canAskQuestion: false,
    canAnswerQuestion: false,
    canModerateQuestions: false,
    navPaddingTop: 20,
    useNewUI: true,
    timelineVariant: "modern",
  },

  onLoad: function (options) {
    var userId = options.userId || app.globalData.currentUserId;
    // 分享暂时关闭（未审核小程序分享会触发"违规"提示）
    if (wx.hideShareMenu) wx.hideShareMenu();
    this.setData({
      userId: userId,
      nodeTypes: app.globalData.NODE_TYPES,
      navPaddingTop: (app.globalData.statusBarHeight || 20) + 14,
    });
    this._ensureUserReady();
  },

  onShow: function () {
    if (!app.requireAuth()) return;
    // 仅在未加载或 userId 变化时刷新，避免重复 setData
    if (!this._loaded || this.data.selectedUser.userId !== this.data.userId) {
      this._ensureUserReady();
    }
  },

  // 分享 onShareAppMessage / onShareTimeline 暂时关闭，上架后恢复

  _ensureUserReady: function () {
    var that = this;
    var userId = this.data.userId;
    if (!userId) return;

    // 优先：本地缓存命中（首页已加载过）
    var cached = app.getUser && app.getUser(userId);
    if (cached) {
      this._refreshUser();
      this._loaded = true;
      // 后台拉 activities cache（异步，不阻塞）
      if (app.getActivitiesCache) {
        app.getActivitiesCache(function (acts) {
          if (acts && acts.length && that.data.userId === userId) {
            that._renderActivityNodes(acts);
          }
        });
      }
      return;
    }

    // 缓存未命中：直接调云函数 getUserProfile（不依赖首页全量加载）
    if (this._loadingProfile) return;
    this._loadingProfile = true;
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: {
        type: 'getUserProfile',
        userId: userId,
        dataType: app.globalData.dataType
      },
      success: function (res) {
        that._loadingProfile = false;
        var user = res.result && res.result.success && res.result.data;
        if (user) {
          // 注入到全局缓存供其他地方复用
          if (!app.globalData.users) app.globalData.users = [];
          var existing = app.globalData.users.findIndex(function (u) {
            return (u.userId || u.id) === user.userId;
          });
          if (existing === -1) app.globalData.users.push(user);
          else app.globalData.users[existing] = user;
          that._refreshUser();
          that._loaded = true;
        } else {
          wx.showToast({ title: '用户不存在', icon: 'none' });
        }
      },
      fail: function () {
        that._loadingProfile = false;
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  /**
   * activities collection 加载后，重新计算 nodes（join activity 详情）
   */
  _renderActivityNodes: function (activitiesCollection) {
    var that = this;
    var user = app.getUser(this.data.userId);
    if (!user) return;
    var actMap = {};
    (activitiesCollection || []).forEach(function (a) {
      actMap[a.activityKey] = a;
    });
    // 给 user.nodes 里有 activityKey 的补充活动详情（仅展示用，不写回 user 对象避免污染）
    var enrichedNodes = (user.nodes || []).map(function (node) {
      if (node.activityKey && actMap[node.activityKey]) {
        var act = actMap[node.activityKey];
        return Object.assign({}, node, {
          desc: node.desc || act.title,
          title: act.title,
          summary: act.summary,
          location: act.location,
          date: node.date || act.date || node.joinedDate,
          dateRange: node.dateRange || act.dateRange || '',
          images: (node.images && node.images.length) ? node.images : (act.images || []),
          keyHighlights: act.keyHighlights || node.keyHighlights || [],
          coverImage: act.coverImage,
          collectiveActivity: act.collectiveActivity !== false,
          type: node.type || act.type
        });
      }
      return Object.assign({}, node, { date: node.date || node.joinedDate });
    });
    var canManageProfile = this.data.canManageProfile;
    var sortedNodes = this._buildDisplayNodes({ nodes: enrichedNodes }, canManageProfile);
    this.setData({ sortedNodes: sortedNodes });
  },

  _buildDisplayQa: function (user, canManageProfile) {
    return (user.qa || [])
      .map(function (item, index) {
        return Object.assign({}, item, {
          _qaIndex: index,
          hidden: item.visibility === "hidden",
        });
      })
      .filter(function (item) {
        if (canManageProfile) return item.status !== "deleted";
        return item.status !== "deleted" && item.visibility !== "hidden";
      });
  },

  _buildDisplayNodes: function (user, canManageProfile) {
    var nodes = (user.nodes || []).map(function (node, index) {
      var nextNode = Object.assign({}, node, {
        _idx: index,
        displayImages: app.getMediaUrls
          ? app.getMediaUrls(node.images || [])
          : (node.images || []).slice(),
      });
      if (node.collectiveActivity) {
        var participants = app.getActivityParticipants
          ? app.getActivityParticipants(node)
          : [];
        nextNode.participantCount = participants.length;
        nextNode.activityParticipants = participants.slice(0, 6);
        nextNode.extraParticipantCount = Math.max(participants.length - 6, 0);
      }
      return nextNode;
    });

    if (!canManageProfile) {
      nodes = nodes.filter(function (node) {
        return !node.hidden && node.visibility !== "hidden";
      });
    }

    return nodes.sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });
  },

  _refreshUser: function () {
    var that = this;
    var user = app.getUser(this.data.userId);
    if (!user) return;

    var cityDisplay = "";
    if (util.isFieldVisible(user, "city") && user.city) {
      cityDisplay = util.normalizeCityList(user.city).join("、");
    }

    var isLishi = util.isFoundingDirector(user);
    var isBoundMember = app.isBoundMemberMode
      ? app.isBoundMemberMode()
      : !(app.isGuestMode && app.isGuestMode()) && !(app.isStaffMode && app.isStaffMode());
    var isOwner = !!(isBoundMember && this.data.userId === app.globalData.currentUserId);
    var canManageProfile = !!(
      (app.canUseGodView && app.canUseGodView()) ||
      (app.canManageUser && app.canManageUser(this.data.userId))
    );
    var canEditProfile = !!(
      canManageProfile ||
      (app.canEditUserProfile && app.canEditUserProfile(this.data.userId))
    );
    var canAnswerQuestion = !!(isOwner || canManageProfile);
    var sortedNodes = this._buildDisplayNodes(user, canManageProfile);
    var selectedUserQa = this._buildDisplayQa(user, canManageProfile);
    var birthdayParsed = util.parseBirthday(user.birthday);
    var birthdayDisplay = "";
    if (util.isFieldVisible(user, "birthday") && user.birthday) {
      birthdayDisplay = birthdayParsed ? (birthdayParsed.month + "月") : user.birthday;
    }
    var zodiacDisplay = "";
    if (util.isFieldVisible(user, "zodiac")) {
      zodiacDisplay = user.zodiac || util.deriveZodiacFromBirthday(user.birthday) || "";
    }
    var selectedUser = Object.assign({}, user, {
      avatarUrl: app.getMediaUrl
        ? app.getMediaUrl(user.avatarImage) || util.getAvatarUrl(user, 80)
        : util.getAvatarUrl(user, 80),
      avatarInitial: util.getAvatarInitial(user),
      favoriteGroups: util.buildFavoriteGroups ? util.buildFavoriteGroups(user) : [],
      educationTags: util.isFieldVisible(user, "education")
        ? (util.splitEducationTags ? util.splitEducationTags(user.education) : [])
        : [],
      cityDisplay: cityDisplay,
      isLishi: isLishi,
      isBirthdayMonth: util.isBirthdayInCurrentMonth(user),
      detailVisibility: user.visibility || {},
      skills: user.skills || [],
      expertise: user.expertise || [],
      tags: user.tags || [],
      gallup: util.isFieldVisible(user, "gallup") ? user.gallup || [] : [],
      hobbies: util.isFieldVisible(user, "hobbies")
        ? util.normalizeHobbyList(user.hobbies || [])
        : [],
      mbti: util.isFieldVisible(user, "mbti") ? user.mbti || "" : "",
      company: util.isFieldVisible(user, "company") ? user.company || "" : "",
      education: util.isFieldVisible(user, "education")
        ? user.education || ""
        : "",
      zodiac: zodiacDisplay,
      mottoSource: user.mottoSource || "",
      birthday: util.isFieldVisible(user, "birthday")
        ? user.birthday || ""
        : "",
      birthdayDisplay: birthdayDisplay,
    });

    var hasProfileInfo = !!(
      selectedUser.mbti ||
      selectedUser.cityDisplay ||
      selectedUser.career ||
      selectedUser.company ||
      selectedUser.education ||
      selectedUser.gallup.length ||
      selectedUser.hobbies.length ||
      (user.expertise && user.expertise.length) ||
      (user.tags && user.tags.length)
    );

    var hasDetailInfo = !!(
      selectedUser.mbti ||
      selectedUser.cityDisplay ||
      selectedUser.career ||
      selectedUser.company ||
      selectedUser.education ||
      selectedUser.zodiac ||
      selectedUser.gallup.length ||
      selectedUser.hobbies.length ||
      selectedUser.favoriteGroups.length ||
      (user.skills && user.skills.length) ||
      (user.expertise && user.expertise.length) ||
      (user.tags && user.tags.length) ||
      canManageProfile
    );
    var publicQaCount = (user.qa || []).filter(function (item) {
      return item.status !== "deleted" && item.visibility !== "hidden";
    }).length;
    var qaCountForDisplay = canManageProfile
      ? selectedUserQa.length
      : publicQaCount;

    var completeness = util.profileCompleteness(user);
    var missingFieldsText = util.getMissingFields(user).join("、");

    // 媒体预取（不再二次 setData，避免重复渲染）
    if (app.prefetchMediaUrls) {
      app.prefetchMediaUrls(
        [user.avatarImage].concat(
          (user.nodes || []).reduce(function (acc, node) {
            return acc.concat(node.images || []);
          }, []),
        ),
      );
    }

    var introSourceKey = this._buildFunnyIntroSourceKey(selectedUser);
    var introUsesMemberLine = this._hasMemberOneLiner(selectedUser);
    var funnyIntroOptions = this._buildFunnyIntroOptions(
      selectedUser,
      introSourceKey,
    );
    var funnyIntroVariantIndex = this._resolveFunnyIntroIndex(
      user,
      funnyIntroOptions,
      introSourceKey,
    );

    this.setData({
      selectedUser: selectedUser,
      isOwner: isOwner,
      canEditProfile: canEditProfile,
      canManageProfile: canManageProfile,
      canEditOthers:
        canManageProfile && !isOwner,
      canAnswerQuestion: canAnswerQuestion,
      canModerateQuestions: canManageProfile,
      canAskQuestion: !!(isBoundMember && !isOwner),
      sortedNodes: sortedNodes,
      selectedUserQa: selectedUserQa,
      qaVisibleCount: qaCountForDisplay,
      qaEmptyText:
        qaCountForDisplay === 0
          ? isOwner
            ? "暂时还没有收到提问"
            : "还没有问题"
          : "",
      hasProfileInfo: hasProfileInfo,
      hasDetailInfo: hasDetailInfo,
      growthTotal: util.computeGrowthValue(user),
      heroMotto: introUsesMemberLine ? this._normalizeMotto(selectedUser.motto) : "",
      funnyIntro: funnyIntroOptions[funnyIntroVariantIndex] || "",
      funnyIntroOptions: funnyIntroOptions,
      funnyIntroVariantIndex: funnyIntroVariantIndex,
      funnyIntroSourceLabel: "AI锐评",
      funnyIntroIsAi: true,
      canRefreshFunnyIntro: !!canEditProfile,
      canAutoGenerateFunnyIntro: !!(isBoundMember || canEditProfile),
      funnyIntroRefreshing: false,
      completeness: completeness,
      missingFieldsText: missingFieldsText,
      similarUsers: [],
      similarityTitle: isOwner ? "和你最像的会员" : "和TA最像的会员",
      similarUsersTitle: isOwner ? "和你最像的会员" : "和TA最像的会员",
      similarUsersHint: "",
      pageLoading: false,
    });

    // 延迟计算相似用户（非首屏关键，避免阻塞渲染）
    var thatRef = this;
    var targetUserId = this.data.userId;
    setTimeout(function () {
      if (thatRef.data.userId !== targetUserId) return;
      thatRef._renderSimilarUsers(user);
    }, 200);

    // funnyIntro 也延迟
    setTimeout(function () {
      if (thatRef.data.userId !== targetUserId) return;
      if (!thatRef.data.canAutoGenerateFunnyIntro) return;
      thatRef._ensureFunnyIntro(user);
    }, 300);
  },

  _hasMemberOneLiner: function (user) {
    var memberLineSources = {
      "member-2026": true,
      "member-edited": true,
      "poster-2025": true,
      "poster-2025-note": true,
    };
    return !!(
      user &&
      user.motto &&
      memberLineSources[user.mottoSource]
    );
  },

  _buildFunnyIntroSourceKey: function (user) {
    var source = [
      user && user.mbti,
      (user && user.cityDisplay) || util.normalizeCityList(user && user.city).join("、"),
      user && user.career,
      user && user.company,
      user && user.education,
      (user && user.gallup || []).join("、"),
      util.normalizeHobbyList((user && user.hobbies) || []).join("、"),
      (user && user.expertise || []).join("、"),
      (user && user.tags || []).join("、"),
    ].join("|");
    var hash = 0;
    for (var i = 0; i < source.length; i++) {
      hash = ((hash * 31) + source.charCodeAt(i)) >>> 0;
    }
    return String(hash);
  },

  _isFunnyIntroFresh: function (user, sourceKey) {
    return !!(
      user &&
      user.aiFunnyIntro &&
      user.aiFunnyIntroVersion === AI_FUNNY_INTRO_VERSION &&
      user.aiFunnyIntroSourceKey === sourceKey
    );
  },

  // 提取会员"自己的一句话"，去掉首尾引号，交给 hero 用引号样式展示
  _normalizeMotto: function (motto) {
    var s = (motto == null ? "" : String(motto)).trim();
    s = s.replace(/^[「『“"']+/, "").replace(/[」』”"']+$/, "").trim();
    return s;
  },

  _buildFunnyIntroOptions: function (user, sourceKey) {
    // AI 锐评始终独立于会员"一句话"：不再用 motto 短路，保证两者可同时展示
    var originalUser = app.getUser && user ? app.getUser(user.userId || user.id) : null;
    var candidates = [];
    if (this._isFunnyIntroFresh(originalUser, sourceKey)) {
      candidates.push(originalUser.aiFunnyIntro);
    }
    candidates = candidates.concat(util.buildFunnyIntroOptions(user) || []);

    var seen = {};
    return candidates
      .map(this._normalizeFunnyIntro)
      .filter(function (text) {
        if (!text || seen[text]) return false;
        seen[text] = true;
        return true;
      })
      .slice(0, 5);
  },

  _resolveFunnyIntroIndex: function (user, options, sourceKey) {
    if (!options || !options.length) return 0;
    if (this._isFunnyIntroFresh(user, sourceKey)) {
      var selected = this._normalizeFunnyIntro(user.aiFunnyIntro);
      var existingIndex = options.indexOf(selected);
      if (existingIndex !== -1) return existingIndex;
    }
    var savedIndex = Number(user && user.aiFunnyIntroVariantIndex);
    if (isFinite(savedIndex)) return savedIndex % options.length;
    var seed = Number(sourceKey);
    if (!isFinite(seed)) seed = 0;
    return seed % options.length;
  },

  _renderSimilarUsers: function (user) {
    var allUsers = (app.globalData.users || []).filter(function (u) {
      return u && u.dataType === user.dataType && u.memberStatus === "active";
    });
    if (!allUsers.length) return;
    var similarResults = util.findSimilarUsers(user, allUsers, 4);
    var similarUsers = similarResults.map(function (item) {
      return {
        user: item.user,
        avatarImage: item.user.avatarImage || "",
        avatarUrl: app.getMediaUrl
          ? app.getMediaUrl(item.user.avatarImage) || util.getAvatarUrl(item.user, 80)
          : util.getAvatarUrl(item.user, 80),
        avatarInitial: util.getAvatarInitial(item.user),
        score: item.score,
        reason:
          item.detail && item.detail.reasons && item.detail.reasons.length
            ? serendipityReason(item.detail.reasons)
            : "志趣相投",
        breakdown: item.detail ? item.detail.breakdown : [],
      };
    });
    this.setData({ similarUsers: similarUsers });
  },

  _buildFunnyIntroPrompt: function (user) {
    var city = util.normalizeCityList(user.city).join("、");
    return [
      "请根据以下会员资料，写一句中文、简短、轻松、有辨识度的 AI 锐评。",
      "要求：",
      "1. 只基于资料内容，不要编造；必须用到至少一个具体资料点。",
      "2. 不要提加入 YOLO 时间、成长值、完整度。",
      "3. 不要使用夸张营销口吻，不要超过 34 个字。",
      "4. 禁止出现“抬高3度”“抬高 3 度”“气氛组”“灵魂续费”等套话。",
      "5. 只返回这一句话，不要解释，不要加括号、字数说明、备注。",
      "资料：",
      "姓名：" + (user.name || ""),
      "城市：" + city,
      "职业：" + (user.career || ""),
      "公司：" + (user.company || ""),
      "MBTI：" + (user.mbti || ""),
      "盖洛普：" + (user.gallup || []).join("、"),
      "爱好：" + util.normalizeHobbyList(user.hobbies || []).join("、"),
      "擅长：" + (user.expertise || []).join("、"),
      "标签：" + (user.tags || []).join("、"),
    ].join("\n");
  },

  _normalizeFunnyIntro: function (text) {
    var normalized = String(text || "")
      .replace(/\s+/g, " ")
      .replace(/[（(]\s*\d+\s*字\s*[)）]/g, "")
      .replace(/[（(][^)）]*(字数|字数统计|字符数|备注)[^)）]*[)）]/g, "")
      .trim();
    if (
      (normalized.charAt(0) === "“" && normalized.charAt(normalized.length - 1) === "”") ||
      (normalized.charAt(0) === '"' && normalized.charAt(normalized.length - 1) === '"')
    ) {
      normalized = normalized.slice(1, -1).trim();
    }
    if (/抬高\s*3\s*度|气氛组|灵魂续费/.test(normalized)) return "";
    return normalized.slice(0, 48);
  },

  _ensureFunnyIntro: function (user) {
    var that = this;
    var userId = user && (user.userId || user.id);
    if (!userId) return;
    var sourceKey = this._buildFunnyIntroSourceKey(user);
    if (this._isFunnyIntroFresh(user, sourceKey)) return;
    if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI) return;

    var requestKey = userId + ":" + AI_FUNNY_INTRO_VERSION + ":" + sourceKey;
    if (this._aiIntroPendingKey === requestKey) return;
    this._aiIntroPendingKey = requestKey;

    var model = wx.cloud.extend.AI.createModel("hunyuan-exp");
    model
      .generateText({
        model: "hunyuan-2.0-instruct-20251111",
        messages: [
          {
            role: "user",
            content: this._buildFunnyIntroPrompt(user),
          },
        ],
      })
      .then(function (res) {
        var text = that._normalizeFunnyIntro(
          (res &&
            (res.text ||
              (res.choices &&
                res.choices[0] &&
                res.choices[0].message &&
                res.choices[0].message.content))) ||
            "",
        );
        if (!text) return;
        var currentUser = app.getUser(that.data.userId);
        if (!currentUser) return;
        currentUser.aiFunnyIntro = text;
        currentUser.aiFunnyIntroVersion = AI_FUNNY_INTRO_VERSION;
        currentUser.aiFunnyIntroSourceKey = sourceKey;
        currentUser.aiFunnyIntroVariantIndex = 0;
        var currentSourceKey = that._buildFunnyIntroSourceKey(that.data.selectedUser);
        if (currentSourceKey !== sourceKey) return;
        var options = that._buildFunnyIntroOptions(that.data.selectedUser, sourceKey);
        that.setData({
          funnyIntro: text,
          funnyIntroOptions: options,
          funnyIntroVariantIndex: Math.max(options.indexOf(text), 0),
        });
        that._syncUserUpdates({
          aiFunnyIntro: text,
          aiFunnyIntroVersion: AI_FUNNY_INTRO_VERSION,
          aiFunnyIntroSourceKey: sourceKey,
          aiFunnyIntroVariantIndex: 0,
        }).catch(function (error) {
          console.warn("save generated funny intro failed", error);
        });
      })
      .catch(function (error) {
        console.warn("generate funny intro failed", error);
      })
      .finally(function () {
        that._aiIntroPendingKey = null;
      });
  },

  onRefreshFunnyIntro: function () {
    if (!this.data.canRefreshFunnyIntro || this.data.funnyIntroRefreshing) {
      return;
    }
    var that = this;
    var user = this.data.selectedUser;
    if (!user || !user.name) return;
    var sourceKey = this._buildFunnyIntroSourceKey(user);
    var options = this.data.funnyIntroOptions && this.data.funnyIntroOptions.length
      ? this.data.funnyIntroOptions
      : this._buildFunnyIntroOptions(user, sourceKey);
    if (!options.length) return;

    var nextIndex = (Number(this.data.funnyIntroVariantIndex || 0) + 1) % options.length;
    var nextText = options[nextIndex];
    var currentUser = app.getUser && app.getUser(user.userId || user.id);
    var prevText = this.data.funnyIntro;
    var prevIndex = this.data.funnyIntroVariantIndex || 0;
    var prevUserIntro = currentUser && currentUser.aiFunnyIntro;
    var prevUserIntroIndex = currentUser && currentUser.aiFunnyIntroVariantIndex;
    if (currentUser) {
      currentUser.aiFunnyIntro = nextText;
      currentUser.aiFunnyIntroVersion = AI_FUNNY_INTRO_VERSION;
      currentUser.aiFunnyIntroSourceKey = sourceKey;
      currentUser.aiFunnyIntroVariantIndex = nextIndex;
    }

    this.setData({
      funnyIntro: nextText,
      funnyIntroOptions: options,
      funnyIntroVariantIndex: nextIndex,
      funnyIntroRefreshing: true,
    });

    this._syncUserUpdates({
      aiFunnyIntro: nextText,
      aiFunnyIntroVersion: AI_FUNNY_INTRO_VERSION,
      aiFunnyIntroSourceKey: sourceKey,
      aiFunnyIntroVariantIndex: nextIndex,
    })
      .catch(function () {
        if (currentUser) {
          currentUser.aiFunnyIntro = prevUserIntro;
          currentUser.aiFunnyIntroVariantIndex = prevUserIntroIndex;
        }
        that.setData({
          funnyIntro: prevText,
          funnyIntroVariantIndex: prevIndex,
        });
        wx.showToast({ title: "保存失败，稍后再试", icon: "none" });
      })
      .finally(function () {
        that.setData({ funnyIntroRefreshing: false });
      });
  },

  _syncUserUpdates: function (updates) {
    return wx.cloud.callFunction({
      name: "yoloFunctions",
      data: {
        type: "updateUser",
        userId: this.data.userId,
        dataType: app.globalData.dataType,
        updates: updates,
      },
    }).then(function (res) {
      var result = res && res.result;
      if (!result || result.success === false) {
        return Promise.reject(new Error((result && result.error) || "保存失败"));
      }
      return result;
    });
  },

  onGoBack: function () {
    wx.navigateBack();
  },

  onEditProfile: function () {
    if (!this.data.canEditProfile) return;
    wx.navigateTo({
      url: "/pages/edit-profile/edit-profile?userId=" + this.data.userId,
    });
  },

  onToggleUI: function () {
    this.setData({ useNewUI: !this.data.useNewUI });
  },

  onToggleTimeline: function () {
    this.setData({
      timelineVariant:
        this.data.timelineVariant === "modern" ? "minimal" : "modern",
    });
  },

  onToggleProfileDetail: function () {
    this.setData({ profileDetailExpanded: !this.data.profileDetailExpanded });
  },

  onToggleFavorites: function () {
    this.setData({ favoritesExpanded: !this.data.favoritesExpanded });
  },

  // 主头像加载失败：重新解析临时 URL，仍失败退回首字
  onAvatarMainError: function () {
    var that = this;
    var fileID = this.data.selectedUser && this.data.selectedUser.avatarImage;
    if (!fileID || this._mainAvatarRetried) {
      this.setData({ "selectedUser.avatarUrl": "" });
      return;
    }
    this._mainAvatarRetried = true;
    if (app.refreshMediaUrl) {
      app.refreshMediaUrl(fileID, function (url) {
        that.setData({ "selectedUser.avatarUrl": url || "" });
      });
    } else {
      this.setData({ "selectedUser.avatarUrl": "" });
    }
  },

  // 相似会员头像加载失败：重新解析，仍失败退回首字
  onSimilarAvatarError: function (e) {
    var that = this;
    var idx = Number(e.currentTarget.dataset.index);
    var list = this.data.similarUsers || [];
    var item = list[idx];
    if (!item || !item.avatarImage || item._avatarRetried) {
      if (item) this.setData(this._similarPatch(idx, { avatarUrl: "", _avatarRetried: true }));
      return;
    }
    this.setData(this._similarPatch(idx, { _avatarRetried: true }));
    if (app.refreshMediaUrl) {
      app.refreshMediaUrl(item.avatarImage, function (url) {
        that.setData(that._similarPatch(idx, { avatarUrl: url || "" }));
      });
    } else {
      this.setData(this._similarPatch(idx, { avatarUrl: "" }));
    }
  },

  _similarPatch: function (idx, fields) {
    var patch = {};
    Object.keys(fields).forEach(function (k) {
      patch["similarUsers[" + idx + "]." + k] = fields[k];
    });
    return patch;
  },

  onExplainSimilarity: function () {
    wx.showModal({
      title: "相似度算法说明",
      content:
        "同 MBTI +3，同城 +2，共同爱好每项 +1，共同技能每项 +1，加入年份相差不超过 1 年 +1。当前卡片上的说明会展示命中的主要原因。",
      showCancel: false,
    });
  },

  onGrowthTap: function () {
    var user = this.data.selectedUser;
    if (!user) return;

    var cityVal = util.normalizeCityList(user.city).join("、");
    var profileFields = [
      user.name,
      user.motto,
      user.mbti,
      cityVal,
      user.career,
      user.company,
      user.education,
      user.zodiac,
      user.wechat,
      user.birthday,
    ];
    var filledCount = profileFields.filter(function (f) {
      return f && String(f).trim();
    }).length;
    var profilePts = Math.min(filledCount * 5, 50);
    var skillPts = Math.min((user.skills || []).length * 5, 30);
    var goalPts = user.goal ? 20 : 0;
    var nodePts = (user.nodes || []).length * 15;
    var photoPts = 0;
    (user.nodes || []).forEach(function (n) {
      photoPts += Math.min((n.images || []).length * 3, 9);
    });
    var hobbyExp = (user.hobbies || []).length + (user.expertise || []).length;
    var hobbyPts = Math.min(hobbyExp * 3, 30);
    var qaAnswered = (user.qa || []).filter(function (q) {
      return q.answer;
    }).length;
    var qaPts = Math.min(qaAnswered * 10, 50);
    var total =
      profilePts + skillPts + goalPts + nodePts + photoPts + hobbyPts + qaPts;

    this.setData({
      showGrowthModal: true,
      growthTotal: total,
      growthRows: [
        {
          icon: "👤",
          bg: "#2563eb",
          label: "基础资料",
          detail: filledCount + "/10 项已填 · 每项+5 · 上限50",
          pts: profilePts,
        },
        {
          icon: "📜",
          bg: "#10b981",
          label: "技能标签",
          detail: (user.skills || []).length + " 个 · 每个+5 · 上限30",
          pts: skillPts,
        },
        {
          icon: "🎯",
          bg: "#f59e0b",
          label: "年度目标",
          detail: user.goal ? "已设定 · +20" : "未设定 · +0",
          pts: goalPts,
        },
        {
          icon: "🛤️",
          bg: "#db2777",
          label: "成长节点",
          detail: (user.nodes || []).length + " 个 · 每个+15 · 无上限",
          pts: nodePts,
        },
        {
          icon: "🖼️",
          bg: "#2563eb",
          label: "节点配图",
          detail: "每张+3 · 每节点上限9",
          pts: photoPts,
        },
        {
          icon: "❤️",
          bg: "#be185d",
          label: "爱好+专长",
          detail: hobbyExp + " 项 · 每项+3 · 上限30",
          pts: hobbyPts,
        },
        {
          icon: "💬",
          bg: "#7c3aed",
          label: "问答回答",
          detail: qaAnswered + " 个已答 · 每个+10 · 上限50",
          pts: qaPts,
        },
      ],
    });
  },

  onCloseGrowthModal: function () {
    this.setData({ showGrowthModal: false });
  },

  noop: function () {},

  onSetGoal: function () {
    if (!this.data.canEditProfile) return;
    var that = this;
    wx.showModal({
      title: "设定年度目标",
      editable: true,
      placeholderText: "请输入你的年度目标",
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          var goal = res.content.trim();
          wx.showLoading({ title: "保存中..." });
          that._syncUserUpdates({ goal: goal }).then(function () {
            wx.hideLoading();
            var user = app.getUser(that.data.userId);
            if (user) user.goal = goal;
            that._refreshUser();
            wx.showToast({ title: "已保存", icon: "success" });
          }).catch(function (error) {
            wx.hideLoading();
            wx.showToast({ title: error.message || "保存失败", icon: "none" });
          });
        }
      },
    });
  },

  onAvatarEdit: function () {
    if (!this.data.canEditProfile) return;
    this.setData({ showAvatarPicker: true });
  },

  // 点击头像 → 全屏预览（系统提供保存按钮）
  onAvatarPreview: function () {
    var su = this.data.selectedUser || {};
    var url = su.avatarUrl;
    var raw = su.avatarImage;
    if (!url && !raw) return;
    // 已经是 https URL → 直接预览
    if (url && url.indexOf('https://') === 0) {
      wx.previewImage({ current: url, urls: [url] });
      return;
    }
    // 还是 cloud:// 或缓存未命中 → 实时换签名 URL
    var ref = (url && url.indexOf('cloud://') === 0) ? url : raw;
    if (!ref) return;
    wx.cloud.getTempFileURL({ fileList: [ref] }).then(function (r) {
      var fresh = r.fileList && r.fileList[0] && r.fileList[0].tempFileURL;
      if (fresh) wx.previewImage({ current: fresh, urls: [fresh] });
      else wx.showToast({ title: '图片加载失败', icon: 'none' });
    }).catch(function () {
      wx.showToast({ title: '图片加载失败', icon: 'none' });
    });
  },

  onAvatarSelect: function (e) {
    if (!this.data.canEditProfile) return;
    var that = this;
    var updates = {
      avatarStyle: e.detail.style,
      avatarSeed: e.detail.seed,
    };
    this.setData({ showAvatarPicker: false });
    wx.showLoading({ title: "保存中..." });
    this._syncUserUpdates(updates).then(function () {
      wx.hideLoading();
      var user = app.getUser(that.data.userId);
      if (user) {
        user.avatarStyle = updates.avatarStyle;
        user.avatarSeed = updates.avatarSeed;
      }
      that._refreshUser();
      wx.showToast({ title: "已保存", icon: "success" });
    }).catch(function (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    });
  },

  // 用户上传自己的照片作为头像
  onAvatarUpload: function (e) {
    if (!this.data.canEditProfile) return;
    var that = this;
    var fileID = e.detail && e.detail.avatarImage;
    if (!fileID) return;
    this.setData({ showAvatarPicker: false });
    wx.showLoading({ title: "保存中..." });
    this._syncUserUpdates({ avatarImage: fileID }).then(function () {
      wx.hideLoading();
      var user = app.getUser(that.data.userId);
      if (user) user.avatarImage = fileID;
      // 预解析新头像的临时 URL 再刷新，避免短暂灰头像
      if (app.refreshMediaUrl) {
        app.refreshMediaUrl(fileID, function () { that._refreshUser(); });
      } else {
        that._refreshUser();
      }
      wx.showToast({ title: "已更新头像", icon: "success" });
    }).catch(function (error) {
      wx.hideLoading();
      wx.showToast({ title: (error && error.message) || "保存失败", icon: "none" });
    });
  },

  onAvatarPickerClose: function () {
    this.setData({ showAvatarPicker: false });
  },

  onSimilarTap: function (e) {
    var userId = e.currentTarget.dataset.userId;
    if (userId) {
      wx.navigateTo({
        url: "/pages/profile/profile?userId=" + userId,
      });
    }
  },

  onToggleFieldVisibility: function (e) {
    if (!this.data.canEditProfile) return;
    var field = e.currentTarget.dataset.field;
    var that = this;
    var user = app.getUser(this.data.userId);
    if (!user) return;
    var nextVisibility = Object.assign({}, user.visibility || {});
    nextVisibility[field] = util.isFieldVisible(user, field) ? false : true;
    wx.showLoading({ title: "保存中..." });
    this._syncUserUpdates({ visibility: nextVisibility }).then(function () {
      wx.hideLoading();
      user.visibility = nextVisibility;
      that._refreshUser();
      wx.showToast({ title: "已保存", icon: "success" });
    }).catch(function (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    });
  },

  _showActivityDetail: function (node) {
    var participants = app.getActivityParticipants
      ? app.getActivityParticipants(node)
      : [];
    var names = participants
      .slice(0, 12)
      .map(function (item) {
        return item.name;
      })
      .join("、");
    var more = participants.length > 12 ? "\n……" : "";
    wx.showModal({
      title: node.desc || "活动详情",
      content:
        "日期：" +
        util.formatDate(node.date) +
        "\n参与成员：" +
        participants.length +
        " 人\n" +
        (names || "暂无成员信息") +
        more,
      showCancel: false,
    });
  },

  _openImageViewer: function (images, index) {
    if (!images || !images.length) return;
    this.setData({
      imageViewerVisible: true,
      viewerImages: images,
      viewerIndex: index || 0,
    });
  },

  onTimelineImageTap: function (e) {
    var images = e.detail.images || [];
    var index = Number(e.detail.index || 0);
    if (!images.length) return;
    if (app.prefetchMediaUrls) {
      app.prefetchMediaUrls(images, function (resolvedImages) {
        wx.previewImage({
          current: resolvedImages[index] || resolvedImages[0],
          urls: resolvedImages,
        });
      });
      return;
    }
    wx.previewImage({
      current: images[index] || images[0],
      urls: images,
    });
  },

  onCloseImageViewer: function () {
    this.setData({
      imageViewerVisible: false,
      viewerImages: [],
      viewerIndex: 0,
    });
  },

  onViewerChange: function (e) {
    this.setData({ viewerIndex: e.detail.current || 0 });
  },

  onTagTap: function (e) {
    var value = e.currentTarget.dataset.value;
    var field = e.currentTarget.dataset.field || "";
    if (!value) return;
    var fieldLabelMap = {
      mbti: "MBTI",
      city: "地点",
      career: "职业",
      company: "公司",
      education: "教育",
      zodiac: "星座",
      gallup: "盖洛普",
      skills: "技能",
      hobbies: "爱好",
      expertise: "擅长",
      tags: "标签",
      favorites: "趣味",
      yoloRole: "YOLO角色",
    };
    if (app.setPendingHomeSearch) {
      app.setPendingHomeSearch({
        query: field ? fieldLabelMap[field] + "：" + value : value,
        value: value,
        field: field,
        filter: "",
      });
    }
    wx.switchTab({
      url: "/pages/index/index",
    });
  },

  onNodeTap: function (e) {
    var nodeIndex = e.detail.index;
    var node = (this.data.sortedNodes || []).find(function (item) {
      return item._idx === nodeIndex;
    });
    if (!node) return;

    if (node.activityKey) {
      wx.navigateTo({
        url: "/pages/activity-detail/activity-detail?activityKey=" + node.activityKey,
      });
      return;
    }

    if (node.type === "activity" && !this.data.canManageProfile) {
      this._showActivityDetail(node);
      return;
    }

    if (!this.data.canManageProfile) return;

    var that = this;
    var itemList =
      node.type === "activity"
        ? [
            "查看活动成员",
            "编辑节点",
            node.hidden || node.visibility === "hidden"
              ? "显示节点"
              : "隐藏节点",
            "删除节点",
          ]
        : [
            "编辑节点",
            node.hidden || node.visibility === "hidden"
              ? "显示节点"
              : "隐藏节点",
            "删除节点",
          ];
    wx.showActionSheet({
      itemList: itemList,
      success: function (res) {
        var user = app.getUser(that.data.userId);
        if (!user || !user.nodes || nodeIndex >= user.nodes.length) return;

        if (node.type === "activity" && res.tapIndex === 0) {
          that._showActivityDetail(node);
          return;
        }

        var actionIndex =
          node.type === "activity" ? res.tapIndex - 1 : res.tapIndex;
        if (actionIndex === 0) {
          wx.navigateTo({
            url:
              "/pages/edit/edit?userId=" +
              that.data.userId +
              "&nodeIndex=" +
              nodeIndex,
          });
        } else if (actionIndex === 1) {
          user.nodes[nodeIndex].hidden = !(
            user.nodes[nodeIndex].hidden ||
            user.nodes[nodeIndex].visibility === "hidden"
          );
          user.nodes[nodeIndex].visibility = user.nodes[nodeIndex].hidden
            ? "hidden"
            : "public";
          that._syncUserUpdates({ nodes: user.nodes });
          that._refreshUser();
        } else if (actionIndex === 2) {
          wx.showModal({
            title: "删除节点",
            content: "确认删除这条成长节点吗？",
            success: function (confirmRes) {
              if (confirmRes.confirm) {
                user.nodes.splice(nodeIndex, 1);
                that._syncUserUpdates({ nodes: user.nodes });
                that._refreshUser();
              }
            },
          });
        }
      },
    });
  },

  onAddNode: function () {
    if (!this.data.canManageProfile) return;
    wx.navigateTo({
      url: "/pages/edit/edit?userId=" + this.data.userId,
    });
  },

  onAskQuestion: function () {
    if (!this.data.canAskQuestion) {
      wx.showToast({ title: "绑定 YOLO+ 成员身份后可提问", icon: "none" });
      return;
    }
    var that = this;
    wx.showModal({
      title: "向 " + this.data.selectedUser.name + " 提问",
      editable: true,
      placeholderText: "输入你想问的问题...",
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          wx.showLoading({ title: "提交中..." });
          wx.cloud.callFunction({
            name: "yoloFunctions",
            data: {
              type: "addQuestion",
              userId: that.data.userId,
              dataType: app.globalData.dataType,
              question: res.content.trim(),
            },
          }).then(function (cloudRes) {
            wx.hideLoading();
            var r = cloudRes && cloudRes.result;
            if (!r || !r.success) {
              wx.showToast({ title: (r && r.error) || "提交失败", icon: "none" });
              return;
            }
            var user = app.getUser(that.data.userId);
            if (user) {
              user.qa = user.qa || [];
              user.qa.push(r.qa || {
                qaId: "qa_" + Date.now(),
                question: res.content.trim(),
                answer: null,
                askedBy: "匿名会员",
                askedByUserId: app.globalData.currentUserId,
                visibility: "public",
                status: "active",
                createdAt: Date.now(),
              });
              that._refreshUser();
            }
            wx.showToast({ title: "已提交", icon: "success" });
          }).catch(function () {
            wx.hideLoading();
            wx.showToast({ title: "提交失败，稍后再试", icon: "none" });
          });
        }
      },
    });
  },

  onAnswerQuestion: function (e) {
    if (!this.data.canAnswerQuestion) return;
    var qaIndex = e.currentTarget.dataset.index;
    var user = app.getUser(this.data.userId);
    if (this.data.selectedUserQa[qaIndex])
      qaIndex = this.data.selectedUserQa[qaIndex]._qaIndex;
    var qa = user.qa[qaIndex];
    var that = this;
    wx.showModal({
      title: "回答问题",
      content: qa.question,
      editable: true,
      placeholderText: "写下你的回答...",
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          wx.showLoading({ title: "保存中..." });
          wx.cloud.callFunction({
            name: "yoloFunctions",
            data: {
              type: "answerQuestion",
              userId: that.data.userId,
              dataType: app.globalData.dataType,
              index: qaIndex,
              answer: res.content.trim(),
            },
          }).then(function (cloudRes) {
            wx.hideLoading();
            var r = cloudRes && cloudRes.result;
            if (!r || !r.success) {
              wx.showToast({ title: (r && r.error) || "保存失败", icon: "none" });
              return;
            }
            qa.answer = res.content.trim();
            qa.answeredAt = Date.now();
            that._refreshUser();
          }).catch(function () {
            wx.hideLoading();
            wx.showToast({ title: "保存失败，稍后再试", icon: "none" });
          });
        }
      },
    });
  },

  onToggleQuestionVisibility: function (e) {
    if (!this.data.canManageProfile) return;
    var qaIndex = e.currentTarget.dataset.index;
    var user = app.getUser(this.data.userId);
    if (this.data.selectedUserQa[qaIndex])
      qaIndex = this.data.selectedUserQa[qaIndex]._qaIndex;
    var qa = user.qa[qaIndex];
    qa.visibility = qa.visibility === "hidden" ? "public" : "hidden";
    this._syncUserUpdates({ qa: user.qa });
    this._refreshUser();
  },

  onDeleteQuestion: function (e) {
    if (!this.data.canManageProfile) return;
    var qaIndex = e.currentTarget.dataset.index;
    var user = app.getUser(this.data.userId);
    if (this.data.selectedUserQa[qaIndex])
      qaIndex = this.data.selectedUserQa[qaIndex]._qaIndex;
    user.qa[qaIndex].status = "deleted";
    this._syncUserUpdates({ qa: user.qa });
    this._refreshUser();
  },
});
