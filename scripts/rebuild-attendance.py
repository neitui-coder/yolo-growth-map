#!/usr/bin/env python3
"""Rebuild yolo-activities-collection.json participants from official xlsx + CSV.

Sources (Sean 提供的官方出席表):
  - 2023年YOLO+会员参与情况.xlsx          (202306-202405 member year)
  - 2024年YOLO+会员参与情况+角色登记.xlsx  (202406-202505)
  - 2025年YOLO+会员参与情况+角色登记.xlsx  (202506-202605)
  - YOLO+出席表-2026武夷山小组活动.csv     (武夷山, xlsx 中该列为空)

放在 ~/Downloads/YOLO+会员活动出席表格/ 与 ~/Downloads/ 下。
"""
import xml.etree.ElementTree as ET
import re, zipfile, json, csv

ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
DL = '/Users/Sean/Downloads'
SHEETS = DL + '/YOLO+会员活动出席表格'


def col_to_idx(col):
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - ord('A') + 1)
    return n - 1


def parse_xlsx(path):
    with zipfile.ZipFile(path) as z:
        with z.open('xl/sharedStrings.xml') as f:
            shared = [''.join((t.text or '') for t in si.iter(ns + 't'))
                      for si in ET.parse(f).getroot().findall(ns + 'si')]
        sheet_files = sorted([n for n in z.namelist()
                              if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')])
        with z.open(sheet_files[0]) as f:
            sheet_root = ET.parse(f).getroot()
    rows = {}
    for row in sheet_root.iter(ns + 'row'):
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
    return rows


with open('/Users/Sean/WeChatProjects/miniprogram-2/data/yolo-2025-members.master.json') as f:
    master = json.load(f)

name_to_uid = {}
for m in master['members']:
    uid = m['identity']['userId']
    name_to_uid[re.sub(r'[\s　]+', '', m['identity']['name'])] = uid
    en = (m['identity'].get('englishName') or '').strip().lower()
    if en:
        name_to_uid[en] = uid

# 手动别名（typo / 二义性 / 往届）。'__skip__' = 非会员/导师/家属，跳过
ALIASES = {
    '解凰尉': 'pdf2025-nara', '解圓尉': 'pdf2025-nara',
    '彭雨(彭唐心)': 'pdf2025-chloe', '彭唐心': 'pdf2025-chloe',
    'bill': 'pdf2025-bill', 'BiLL': 'pdf2025-bill', '陈威全': 'pdf2025-bill',
    'Sarah': None, 'sarah': None,  # 罗琦玥 / 高秋闲 二义性，禁纯英文匹配
    '罗琦玥': 'pdf2025-sarah', '高秋闲': 'pdf2025-sarah-p30',
    'Tony': '__skip__', 'Angela': '__skip__', 'Howard': '__skip__',
    '林乐怡': '__skip__', '计嘉伟': '__skip__', '陈涵宇': '__skip__',
    '唐凯飞': '__skip__', '唐恺飞': '__skip__', '谢承熹': '__skip__',
    '宋相濡': '__skip__', '博媛': '__skip__', '达美欣': '__skip__',
    '周传凯': '__skip__', '范凡': '__skip__',
    '葛琼（导师）': '__skip__', '陈洪生（导师）': '__skip__', '揣姝茵（导师）': '__skip__',
    '林青桐': 'alumni-qingtong', '阮赛茜': 'alumni-saxi', '李嘉怡': 'alumni-jiayi',
    '陈晓萱': 'alumni-xiaoxuan', '邵怡平': 'alumni-yiping', '邵怡安': 'alumni-yian',
    '杜晓欣': 'alumni-xiaoxin', '黄蕾': 'alumni-huanglei', '周浩铖': 'alumni-haocheng',
    '焦桢': 'alumni-kingsley', '金连成': 'alumni-jack', '苏世杰': 'alumni-shijie',
    '胡晋华': 'alumni-jinhua', '胡晓钰': 'alumni-xiaoyu', '纪域呈': 'alumni-yucheng',
    '王睿翔': 'alumni-ruixiang', '欧阳瑾莎': 'alumni-jinsha',
}


def normalize_name(s):
    return re.sub(r'[\s　]+', '', s or '').strip()


def resolve(name):
    n = normalize_name(name)
    if not n:
        return None
    if n in ALIASES:
        v = ALIASES[n]
        return v if v != '__skip__' else None
    return name_to_uid.get(n)


# (col_attended, col_role|None, activityKey)
configs = [
    (f'{SHEETS}/2023年YOLO+会员参与情况.xlsx', [
        (3, None, 'yolo-2023-hongkong'),
        (4, None, 'yolo-2023-japan'),
        (5, None, 'yolo-2023-chongqing'),
        (6, None, 'yolo-2024-shanghai-march'),
    ]),
    (f'{SHEETS}/2024年YOLO+会员参与情况+角色登记.xlsx', [
        (3, 4, 'yolo-2024-shenzhen'),
        (5, 6, 'yolo-2024-singapore'),
        (7, 8, 'yolo-2024-macau'),
        (9, 10, 'yolo-2025-wenling'),
    ]),
    (f'{SHEETS}/2025年YOLO+会员参与情况+角色登记.xlsx', [
        (3, 4, 'yolo-2025-yantai'),
        (5, 6, 'yolo-2025-zhengzhou'),
        (7, 8, 'yolo-2025-middleeast'),
        (9, 10, 'yolo-2025-suzhou'),
        # 武夷山 col 11/12 在 2025 xlsx 为空 —— 用 CSV
        (13, 14, 'yolo-2025-shanghai-group'),
        (15, 16, 'yolo-2025-guangdong-group'),
    ]),
]

attendance = {}
unmatched = {}

for path, acts in configs:
    rows = parse_xlsx(path)
    for ri in sorted(rows.keys()):
        if ri < 4:
            continue
        row = rows[ri]
        name = (row.get(1) or '').strip()
        if not name or name in ('合计', '类别', '序号', '会员姓名'):
            continue
        for col_a, col_r, akey in acts:
            v = (row.get(col_a) or '').strip()
            if v in ('1', '1.0'):
                role = (row.get(col_r) or '').strip() if col_r else ''
                uid = resolve(name)
                if uid:
                    attendance.setdefault(akey, []).append({'userId': uid, 'role': role})
                else:
                    unmatched[name] = unmatched.get(name, 0) + 1

with open(f'{DL}/YOLO+出席表-2026武夷山小组活动.csv') as f:
    rows = list(csv.reader(f))
for r in rows[4:]:
    if len(r) < 5:
        continue
    name = (r[1] or '').strip()
    if not name or (r[3] or '').strip() not in ('1', '1.0'):
        continue
    uid = resolve(name)
    if uid:
        attendance.setdefault('yolo-2026-wuyishan', []).append(
            {'userId': uid, 'role': (r[4] or '').strip()})
    else:
        unmatched[name] = unmatched.get(name, 0) + 1

COL = '/Users/Sean/WeChatProjects/miniprogram-2/data/yolo-activities-collection.json'
with open(COL) as f:
    coll = json.load(f)
for a in coll['activities']:
    a['participants'] = attendance.get(a['activityKey'], [])
with open(COL, 'w', encoding='utf-8') as f:
    json.dump(coll, f, ensure_ascii=False, indent=2)

print('=== 重建后 ===')
for a in coll['activities']:
    print(f"{a['activityKey']:<32} {len(a.get('participants', [])):>3} 人")
if unmatched:
    print('\n未匹配（已跳过，均为非会员/导师/家属）:')
    for n, c in sorted(unmatched.items(), key=lambda x: -x[1]):
        print(f'  {n}  ({c})')
