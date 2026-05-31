var TYPE_META = {
  activity: { emoji: "🤝", label: "集体活动" },
  travel: { emoji: "🌍", label: "游学" },
  annual: { emoji: "🎉", label: "年会" },
};

var MAP_SCOPE_META = {
  china: {
    label: "中国",
    statsPrefix: "已点亮中国",
    statsUnit: "个城市/地区",
    latitude: 31.2304,
    longitude: 112.0,
    scale: 4,
    selectedScale: 6,
  },
  world: {
    label: "世界",
    statsPrefix: "已走向世界",
    statsUnit: "个国家/地区",
    latitude: 22.0,
    longitude: 80.0,
    scale: 2,
    selectedScale: 4,
  },
};

var LOCATION_META = {
  "台湾": { key: "taiwan", label: "台湾", latitude: 23.6978, longitude: 120.9605, isChina: true, focusScale: 6 },
  "深圳": { key: "shenzhen", label: "深圳", latitude: 22.5431, longitude: 114.0579, isChina: true },
  "杭州": { key: "hangzhou", label: "杭州", latitude: 30.2741, longitude: 120.1551, isChina: true },
  "北京": { key: "beijing", label: "北京", latitude: 39.9042, longitude: 116.4074, isChina: true },
  "上海": { key: "shanghai", label: "上海", latitude: 31.2304, longitude: 121.4737, isChina: true },
  "大湾区": { key: "greater-bay-area", label: "大湾区", latitude: 22.82, longitude: 113.75, isChina: true },
  "成都": { key: "chengdu", label: "成都", latitude: 30.5728, longitude: 104.0668, isChina: true },
  "长沙": { key: "changsha", label: "长沙", latitude: 28.2282, longitude: 112.9388, isChina: true },
  "香港": { key: "hongkong", label: "香港", latitude: 22.3193, longitude: 114.1694, isChina: true, focusScale: 7 },
  "美国": { key: "usa", label: "美国", latitude: 39.8283, longitude: -98.5795, isChina: false, focusScale: 3 },
  "法国": { key: "france", label: "法国", latitude: 46.2276, longitude: 2.2137, isChina: false, focusScale: 4 },
  "日本": { key: "japan", label: "日本", latitude: 35.6762, longitude: 139.6503, isChina: false, focusScale: 4 },
  "重庆": { key: "chongqing", label: "重庆", latitude: 29.563, longitude: 106.5516, isChina: true },
  "新加坡": { key: "singapore", label: "新加坡", latitude: 1.3521, longitude: 103.8198, isChina: false, focusScale: 6 },
  "澳门": { key: "macau", label: "澳门", latitude: 22.1987, longitude: 113.5439, isChina: true, focusScale: 7 },
  "温岭": { key: "wenling", label: "温岭", latitude: 28.3718, longitude: 121.3856, isChina: true },
  "烟台": { key: "yantai", label: "烟台", latitude: 37.4638, longitude: 121.4479, isChina: true },
  "郑州": { key: "zhengzhou", label: "郑州", latitude: 34.7466, longitude: 113.6254, isChina: true },
  "中东": { key: "middle-east", label: "中东", latitude: 25.2048, longitude: 55.2708, isChina: false, focusScale: 4 },
  "苏州": { key: "suzhou", label: "苏州", latitude: 31.2989, longitude: 120.5853, isChina: true },
  "广州/深圳": { key: "guangzhou-shenzhen", label: "广州/深圳", latitude: 23.05, longitude: 113.75, isChina: true },
  "武夷山": { key: "wuyishan", label: "武夷山", latitude: 27.7566, longitude: 118.0353, isChina: true },
};

function normalizeScope(scope) {
  return scope === "world" ? "world" : "china";
}

function getLocationMeta(location) {
  var text = String(location || "").trim();
  if (!text || text === "线上" || text === "海外") return null;
  return LOCATION_META[text] || null;
}

function getActivityDateLabel(act) {
  var yearStr = (act.date || "").slice(0, 4);
  var monthStr = (act.date || "").slice(5, 7);
  var yearMonth = yearStr && monthStr ? yearStr + " / " + monthStr : act.date || "";
  var dateLabel = act.dateRange
    ? (yearStr ? yearStr + "年" + act.dateRange : act.dateRange)
    : yearMonth;
  return {
    yearStr: yearStr,
    yearMonth: yearMonth,
    dateLabel: dateLabel,
  };
}

function buildFootprintState(activities, scope, selectedKey, options) {
  var normalizedScope = normalizeScope(scope);
  var scopeMeta = MAP_SCOPE_META[normalizedScope];
  var groupMap = {};
  var unmappedActivityCount = 0;

  (activities || []).forEach(function (act) {
    var location = String(act.location || "").trim();
    if (!location || location === "线上") {
      unmappedActivityCount += 1;
      return;
    }
    var meta = getLocationMeta(location);
    if (!meta) {
      unmappedActivityCount += 1;
      return;
    }
    if (normalizedScope === "china" && !meta.isChina) return;
    if (normalizedScope === "world" && meta.isChina) return;

    if (!groupMap[meta.key]) {
      groupMap[meta.key] = {
        key: meta.key,
        label: meta.label,
        latitude: meta.latitude,
        longitude: meta.longitude,
        isChina: !!meta.isChina,
        focusScale: meta.focusScale,
        activities: [],
        latestDate: "",
        markerId: 0,
      };
    }
    groupMap[meta.key].activities.push(act);
    if ((act.date || "") > groupMap[meta.key].latestDate) {
      groupMap[meta.key].latestDate = act.date || "";
    }
  });

  var groups = Object.keys(groupMap)
    .map(function (key) { return groupMap[key]; })
    .sort(function (a, b) {
      if (b.activities.length !== a.activities.length) {
        return b.activities.length - a.activities.length;
      }
      return (b.latestDate || "").localeCompare(a.latestDate || "");
    })
    .map(function (group, index) {
      return Object.assign({}, group, {
        markerId: index + 1,
        activityCount: group.activities.length,
        latestYear: (group.latestDate || "").slice(0, 4),
      });
    });

  var matchedSelected = groups.find(function (group) {
    return group.key === selectedKey;
  }) || null;
  var shouldAutoSelect = !(options && options.autoSelect === false);
  var selected = matchedSelected || (shouldAutoSelect ? groups[0] || null : null);

  var markerMap = {};
  var markers = groups.map(function (group) {
    var isSelected = selected && group.key === selected.key;
    markerMap[group.markerId] = group.key;
    return {
      id: group.markerId,
      latitude: group.latitude,
      longitude: group.longitude,
      width: isSelected ? 34 : 28,
      height: isSelected ? 34 : 28,
      callout: {
        content: group.label + " " + group.activities.length + "场",
        color: "#0f172a",
        fontSize: 12,
        bgColor: "#ffffff",
        borderRadius: 12,
        padding: 6,
        display: isSelected ? "ALWAYS" : "BYCLICK",
      },
    };
  });

  var includePoints = selected
    ? [{ latitude: selected.latitude, longitude: selected.longitude }]
    : groups.map(function (group) {
        return { latitude: group.latitude, longitude: group.longitude };
      });

  return {
    scope: normalizedScope,
    groups: groups,
    markers: markers,
    markerMap: markerMap,
    includePoints: includePoints,
    selected: selected,
    selectedActivities: selected ? selected.activities.slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    }) : [],
    statsLabel: scopeMeta.statsPrefix + " " + groups.length + " " + scopeMeta.statsUnit,
    onlineActivityCount: unmappedActivityCount,
    mapLatitude: selected ? selected.latitude : scopeMeta.latitude,
    mapLongitude: selected ? selected.longitude : scopeMeta.longitude,
    mapScale: selected ? (selected.focusScale || scopeMeta.selectedScale) : scopeMeta.scale,
  };
}

function buildFootprintOverview(activities) {
  var chinaState = buildFootprintState(activities, "china", null);
  var worldState = buildFootprintState(activities, "world", null);
  return {
    chinaCount: chinaState.groups.length,
    worldCount: worldState.groups.length,
    onlineActivityCount: chinaState.onlineActivityCount,
    chinaLabel: chinaState.groups.length + " 个国内城市/地区",
    worldLabel: worldState.groups.length + " 个海外国家/地区",
    noteLabel: chinaState.onlineActivityCount + " 场线上/未定位",
  };
}

module.exports = {
  TYPE_META: TYPE_META,
  MAP_SCOPE_META: MAP_SCOPE_META,
  LOCATION_META: LOCATION_META,
  getLocationMeta: getLocationMeta,
  getActivityDateLabel: getActivityDateLabel,
  buildFootprintState: buildFootprintState,
  buildFootprintOverview: buildFootprintOverview,
};
