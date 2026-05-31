var app = getApp();

// 活动地点 -> { province(对应 china.json 省名), lng, lat, overseas }
var LOCATION_GEO = {
  '上海': { province: '上海市', lng: 121.4737, lat: 31.2304 },
  '北京': { province: '北京市', lng: 116.4074, lat: 39.9042 },
  '深圳': { province: '广东省', lng: 114.0579, lat: 22.5431 },
  '广州/深圳': { province: '广东省', lng: 113.75, lat: 23.05 },
  '大湾区': { province: '广东省', lng: 113.75, lat: 22.82 },
  '杭州': { province: '浙江省', lng: 120.1551, lat: 30.2741 },
  '温岭': { province: '浙江省', lng: 121.3856, lat: 28.3718 },
  '台湾': { province: '台湾省', lng: 120.9605, lat: 23.6978 },
  '成都': { province: '四川省', lng: 104.0668, lat: 30.5728 },
  '长沙': { province: '湖南省', lng: 112.9388, lat: 28.2282 },
  '重庆': { province: '重庆市', lng: 106.5516, lat: 29.563 },
  '香港': { province: '香港特别行政区', lng: 114.1694, lat: 22.3193 },
  '澳门': { province: '澳门特别行政区', lng: 113.5439, lat: 22.1987 },
  '烟台': { province: '山东省', lng: 121.4479, lat: 37.4638 },
  '郑州': { province: '河南省', lng: 113.6254, lat: 34.7466 },
  '苏州': { province: '江苏省', lng: 120.5853, lat: 31.2989 },
  '武夷山': { province: '福建省', lng: 118.0353, lat: 27.7566 },
  '美国': { overseas: true }, '日本': { overseas: true }, '新加坡': { overseas: true },
  '法国': { overseas: true }, '中东': { overseas: true }, '海外': { overseas: true }
};

function buildMapData(activities) {
  var acts = activities || [];
  var cityCount = {}, provinceCount = {}, overseas = {}, activityTotal = 0;
  acts.forEach(function (a) {
    var loc = (a.location || '').trim();
    if (!loc || loc === '线上' || loc === '?') return;
    var geo = LOCATION_GEO[loc];
    if (!geo) return;
    activityTotal++;
    if (geo.overseas) { overseas[loc] = (overseas[loc] || 0) + 1; return; }
    cityCount[loc] = (cityCount[loc] || 0) + 1;
    provinceCount[geo.province] = (provinceCount[geo.province] || 0) + 1;
  });
  // 去过的省份只做"轻微提亮+淡青描边"，不整块刷亮（整块亮显得很怪）；
  // 真正的"点亮感"交给城市发光点
  var regions = Object.keys(provinceCount).map(function (p) {
    return {
      name: p,
      itemStyle: { areaColor: '#143b5e', borderColor: 'rgba(94,234,212,0.45)', borderWidth: 0.8 }
    };
  });
  var maxC = 1;
  Object.keys(cityCount).forEach(function (c) { if (cityCount[c] > maxC) maxC = cityCount[c]; });
  var points = Object.keys(cityCount).map(function (c) {
    var g = LOCATION_GEO[c];
    return { name: c, value: [g.lng, g.lat, cityCount[c]] };
  });
  return {
    regions: regions, points: points, maxCount: maxC,
    litCount: Object.keys(cityCount).length,
    provinceCount: Object.keys(provinceCount).length,
    activityTotal: activityTotal,
    overseasList: Object.keys(overseas).map(function (k) { return { name: k, count: overseas[k] }; })
  };
}

function buildOption(data) {
  return {
    backgroundColor: '#081a33',
    animation: true,
    hoverLayerThreshold: Infinity,
    geo: {
      map: 'china', roam: true,
      // 活动几乎都在中国东部，聚焦东部、裁掉空旷的西部
      center: [114, 31],
      zoom: 2.6,
      scaleLimit: { min: 1.2, max: 8 },
      label: { show: false },
      itemStyle: { areaColor: '#0f2546', borderColor: '#1e3a5f', borderWidth: 0.6 },
      emphasis: { label: { show: false }, itemStyle: { areaColor: '#163358' } },
      regions: data.regions
    },
    series: [{
      name: '活动城市', type: 'effectScatter', coordinateSystem: 'geo',
      rippleEffect: { brushType: 'stroke', scale: 3.2, period: 3.5 },
      symbolSize: function (val) { return 8 + ((val[2] || 1) / data.maxCount) * 16; },
      itemStyle: { color: '#5eead4', shadowBlur: 12, shadowColor: '#5eead4' },
      label: { show: true, position: 'right', formatter: '{b}', color: '#cffafe', fontSize: 10, fontWeight: 'bold' },
      labelLayout: { hideOverlap: true },
      data: data.points
    }]
  };
}

Page({
  data: {
    ec: { lazyLoad: true },
    errMsg: '',
    litCount: 0,
    provinceCount: 0,
    activityTotal: 0,
    overseasList: []
  },

  onLoad: function () {
    var that = this;
    if (app && app.getActivitiesCache) {
      app.getActivitiesCache(function (acts) { that._renderWith(acts || []); });
    } else {
      that._renderWith([]);
    }
  },

  _renderWith: function (acts) {
    var data = buildMapData(acts);
    this._mapData = data;
    this.setData({
      litCount: data.litCount,
      provinceCount: data.provinceCount,
      activityTotal: data.activityTotal,
      overseasList: data.overseasList
    });
    this._initChartWhenReady();
  },

  onReady: function () {
    var that = this;
    // 延迟一帧，确保 canvas 已完成布局（拿到真实宽高），否则 echarts drawImage 会报错
    setTimeout(function () {
      that._ecReady = true;
      that._initChartWhenReady();
    }, 400);
  },

  _initChartWhenReady: function () {
    if (!this._ecReady || !this._mapData || this._chartInited) return;
    this._chartInited = true;
    var that = this;
    var data = this._mapData;
    var comp = this.selectComponent('#footprintChart');
    if (!comp) { this._chartInited = false; return; }
    var echarts, chinaJson;
    try {
      echarts = require('../../ec-canvas/echarts');
      chinaJson = require('./china.js');
    } catch (e) {
      that.setData({ errMsg: 'echarts/china 加载失败: ' + (e && (e.message || e)) });
      return;
    }
    comp.init(function (canvas, width, height, dpr) {
      try {
        var chart = echarts.init(canvas, null, { width: width, height: height, devicePixelRatio: dpr });
        echarts.registerMap('china', { geoJSON: chinaJson });
        chart.setOption(buildOption(data));
        canvas.setChart(chart);
        that._chart = chart;
        that._zoom = 2.6;
        return chart;
      } catch (e2) {
        that.setData({ errMsg: 'echarts 初始化失败: ' + (e2 && (e2.message || e2)) });
        return null;
      }
    });
  },

  _applyZoom: function (factor) {
    if (!this._chart) return;
    var z = (this._zoom || 1.2) * factor;
    z = Math.max(1, Math.min(6, z));
    this._zoom = z;
    this._chart.setOption({ geo: { zoom: z } });
  },

  onZoomIn: function () { this._applyZoom(1.4); },
  onZoomOut: function () { this._applyZoom(1 / 1.4); }
});
