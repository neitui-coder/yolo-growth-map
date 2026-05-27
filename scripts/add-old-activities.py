#!/usr/bin/env python3
"""把 2019-2022 老活动合并进 yolo-activities-collection.json。

源：~/Downloads/YOLO+出席表.xlsx
  sheet1: 2025-2026（含武夷山，已有）
  sheet2: 2022 — 成都7/长沙8/杭州9/上海年会11
  sheet3: 2021 — 北京7/线上9/上海导师10/大湾区年会11/孙辉12/袁纯2
  sheet4: 2020 — 深圳8/北京9/杭州11
  sheet5: 2019 — 台湾6/法国8/深圳年会11/杭州12
  sheet6: 2020 — 香港6/美国8/上海12-1W/上海12-1S（另一批活动）

参与者：仅保留当前 36-人 master 中实际出现的成员（按姓名匹配）。
"""
import xml.etree.ElementTree as ET
import re, zipfile, json, os
from datetime import datetime

ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
DL = os.path.expanduser('~/Downloads')
ATT = f'{DL}/YOLO+出席表.xlsx'
REPO = '/Users/Sean/WeChatProjects/miniprogram-2'
ACT_OUT = f'{REPO}/data/yolo-activities-collection.json'
MASTER = f'{REPO}/data/yolo-2025-members.master.json'


def col_to_idx(col):
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - ord('A') + 1)
    return n - 1


def parse_xlsx_all_sheets(path):
    with zipfile.ZipFile(path) as z:
        with z.open('xl/sharedStrings.xml') as f:
            shared = [''.join((t.text or '') for t in si.iter(ns + 't'))
                      for si in ET.parse(f).getroot().findall(ns + 'si')]
        sheet_files = sorted([n for n in z.namelist()
                              if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')],
                             key=lambda x: int(re.search(r'sheet(\d+)', x).group(1)))
        sheets = []
        for sf in sheet_files:
            with z.open(sf) as f:
                root = ET.parse(f).getroot()
            rows = {}
            for row in root.iter(ns + 'row'):
                r_idx = int(row.get('r')) - 1
                rows[r_idx] = {}
                for c in row.iter(ns + 'c'):
                    ref = c.get('r')
                    if not ref:
                        continue
                    col_idx = col_to_idx(re.match(r'^([A-Z]+)', ref).group(1))
                    t = c.get('t', 'n')
                    v_el = c.find(ns + 'v')
                    is_el = c.find(ns + 'is')
                    val = ''
                    if v_el is not None and v_el.text is not None:
                        val = shared[int(v_el.text)] if t == 's' else v_el.text
                    elif is_el is not None:
                        val = ''.join((tt.text or '') for tt in is_el.iter(ns + 't'))
                    rows[r_idx][col_idx] = val
            sheets.append(rows)
        return sheets


def norm(s):
    return re.sub(r'[\s　]+', '', s or '').strip()


# 加载当前 master
with open(MASTER, encoding='utf-8') as f:
    master = json.load(f)
name_to_uid = {}
for m in master['members']:
    name = norm(m['identity']['name'])
    name_to_uid[name] = m['identity']['userId']
print(f'当前 master：{len(name_to_uid)} 人')

# Manual aliases
ALIASES = {
    'bill': '陈威全', 'BiLL': '陈威全',
    '彭雨(彭唐心)': '彭唐心',
    '解凰尉': '解圓尉',
    '陈嘉逸': None,  # not in 36
    '蔡之杰': None,  # not in 36
}


def resolve_uid(raw_name):
    """raw name → userId, or None if not in current 36"""
    if not raw_name: return None
    name = norm(raw_name)
    if name in ALIASES:
        alias = ALIASES[name]
        if alias is None: return None
        name = alias
    return name_to_uid.get(name)


# 解析 sheets
sheets = parse_xlsx_all_sheets(ATT)
print(f'出席表共 {len(sheets)} sheet')


# 每个 sheet 的解析配置：
# (sheet_index, header_row, name_col, activity_cols [(col_idx, activityKey, date, type, title)])
# 注意：每个 sheet 的列序号可能不同，看上面 row1 (header) 解析
def get_header_row(sheet):
    """找到包含"姓名"和活动名的 header 行"""
    for ri in sorted(sheet.keys())[:5]:
        r = sheet[ri]
        joined = ' '.join((v or '') for v in r.values())
        if '姓名' in joined and ('活动' in joined or '年会' in joined):
            return ri
    return None


def extract_activities(sheet, year, name_col=1):
    """sheet → [(name_col, activity_cols list)]
    activity_cols = [(col_idx, raw_title)]
    """
    hr = get_header_row(sheet)
    if hr is None:
        return None, []
    header = sheet[hr]
    activity_cols = []
    for c in sorted(header.keys()):
        v = (header[c] or '').strip()
        if not v: continue
        if v in ('序号', '姓名', '会员姓名', '参加次数', '个人总数', '会员名单'):
            continue
        # 排除合计/统计列
        if '次数' in v or '总数' in v:
            continue
        activity_cols.append((c, v))
    return hr, activity_cols


def activity_to_meta(year, raw_title):
    """从原始标题猜活动 key/date/type"""
    title = raw_title.strip()
    # 提取月
    m_month = re.search(r'(\d{1,2})月', title)
    month = int(m_month.group(1)) if m_month else None
    # 提取日范围 - 例如 "8月19-21日"
    m_range = re.search(r'(\d{1,2})月([\d-]+)日', title)
    date_range = ''
    if m_range:
        date_range = m_month.group(1) + '月' + m_range.group(2) + '日'
    # 提取城市/类型
    cities = ['成都', '长沙', '杭州', '上海', '北京', '深圳', '香港', '台湾',
              '法国', '美国', '大湾区', '宁波']
    city = next((c for c in cities if c in title), '')
    is_annual = '年会' in title
    is_online = '线上' in title
    is_mentor = '导师' in title and '小组' in title
    # type
    if is_annual: t = 'annual'
    elif '游学' in title or city in ('台湾', '法国', '美国', '香港'): t = 'travel'
    else: t = 'activity'
    # location
    location = city if city else ('线上' if is_online else '')
    # key
    short = city.lower() if city else ('online' if is_online else 'event')
    suffix = ''
    if is_annual: suffix = '-annual'
    if is_mentor: suffix = '-mentor'
    if month: suffix = f'-{month:02d}'
    short_norm = {'成都':'chengdu','长沙':'changsha','杭州':'hangzhou','上海':'shanghai',
                  '北京':'beijing','深圳':'shenzhen','香港':'hongkong','台湾':'taiwan',
                  '法国':'france','美国':'usa','大湾区':'gba','宁波':'ningbo'}.get(city, short)
    key = f'yolo-{year}-{short_norm}{suffix}'
    # date
    date = f'{year}-{month:02d}' if month else f'{year}-01'
    return {
        'activityKey': key,
        'title': f'YOLO+ {title}',
        'date': date,
        'dateRange': date_range,
        'location': location,
        'type': t,
        'collectiveActivity': True,
        'summary': '',
        'keyHighlights': [],
        'coverImage': None,
        'images': []
    }


# 待解析的 sheet 配置：[(sheet_index, year)]
to_parse = [
    (1, 2022),   # sheet2 idx 1
    (2, 2021),   # sheet3
    (3, 2020),   # sheet4
    (4, 2019),   # sheet5
    (5, 2020),   # sheet6 second half
]

new_activities_by_key = {}
unmatched_names = set()

for si, year in to_parse:
    sheet = sheets[si]
    hr, activity_cols = extract_activities(sheet, year)
    print(f'\n--- {year} (sheet{si+1}) | header row {hr} | {len(activity_cols)} 活动列 ---')
    if not activity_cols: continue
    for ri in sorted(sheet.keys()):
        if ri <= hr: continue
        r = sheet[ri]
        name_raw = (r.get(1) or '').strip()
        if not name_raw or name_raw in ('合计', '类别', '序号', '会员姓名', '现有会员', '新增会员'):
            continue
        uid = resolve_uid(name_raw)
        for col_idx, raw_title in activity_cols:
            v = (r.get(col_idx) or '').strip()
            if v not in ('1', '1.0'): continue
            meta = activity_to_meta(year, raw_title)
            key = meta['activityKey']
            if key not in new_activities_by_key:
                new_activities_by_key[key] = dict(meta, participants=[])
            if uid:
                # 去重
                if not any(p['userId'] == uid for p in new_activities_by_key[key]['participants']):
                    new_activities_by_key[key]['participants'].append({'userId': uid, 'role': ''})
            else:
                unmatched_names.add(name_raw)

# 报告
print('\n=== 新活动汇总 ===')
for key, act in sorted(new_activities_by_key.items()):
    print(f'  {key:<28} {act["dateRange"] or act["date"]:<10} {len(act["participants"]):>2} 人 | {act["title"]}')
print(f'\n未匹配会员（已在 36 之外，跳过）：{len(unmatched_names)} 人')
print('  ', '、'.join(sorted(unmatched_names))[:200])

# 合并进 collection
with open(ACT_OUT, encoding='utf-8') as f:
    col = json.load(f)
existing_keys = {a['activityKey'] for a in col['activities']}

added = 0
for key, act in new_activities_by_key.items():
    if key in existing_keys:
        # update participants only
        for a in col['activities']:
            if a['activityKey'] == key:
                a['participants'] = act['participants']
                break
    else:
        col['activities'].append(act)
        added += 1

# 按 date 重新排序
col['activities'].sort(key=lambda a: a.get('date', ''))

with open(ACT_OUT, 'w', encoding='utf-8') as f:
    json.dump(col, f, ensure_ascii=False, indent=2)

print(f'\n写入 {ACT_OUT}')
print(f'  新增活动：{added}，更新已有：{len(new_activities_by_key) - added}')
print(f'  Collection 现有活动总数：{len(col["activities"])}')
