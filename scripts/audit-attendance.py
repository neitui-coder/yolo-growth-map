#!/usr/bin/env python3
"""数据准确性审计：对每个会员，从源 xlsx 重新算出应参与活动，与 collection 对比。

源：
  ~/Downloads/YOLO+出席表.xlsx           — sheet1=2025-2026 (武夷山一列), sheet2=2022, sheet3=2021, sheet4=2020, sheet5=2019
  ~/Downloads/YOLO+出席表-2026武夷山小组活动.csv — 2026 武夷山 (sheet1 已含但 CSV 更全)
  3 个老的 2023/2024/2025 xlsx 还要不要？
    - 2023年YOLO+会员参与情况.xlsx
    - 2024年YOLO+会员参与情况+角色登记.xlsx
    - 2025年YOLO+会员参与情况+角色登记.xlsx

注：本审计只能用现有源文件。若有错请 Sean 提供更新版 xlsx 重审。
"""
import xml.etree.ElementTree as ET
import re, zipfile, json, csv, os

ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
DL = os.path.expanduser('~/Downloads')
REPO = '/Users/Sean/WeChatProjects/miniprogram-2'


def col_to_idx(c):
    n=0
    for ch in c: n=n*26+(ord(ch)-ord('A')+1)
    return n-1


def parse_xlsx(path):
    with zipfile.ZipFile(path) as z:
        with z.open('xl/sharedStrings.xml') as f:
            shared = [''.join((t.text or '') for t in si.iter(ns+'t')) for si in ET.parse(f).getroot().findall(ns+'si')]
        sf = sorted([n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')], key=lambda x: int(re.search(r'sheet(\d+)', x).group(1)))
        sheets = []
        for s in sf:
            with z.open(s) as f: root = ET.parse(f).getroot()
            rows = {}
            for row in root.iter(ns+'row'):
                ri = int(row.get('r'))-1
                rows[ri] = {}
                for c in row.iter(ns+'c'):
                    ref = c.get('r')
                    if not ref: continue
                    ci = col_to_idx(re.match(r'^([A-Z]+)', ref).group(1))
                    t = c.get('t','n'); v = c.find(ns+'v'); ise = c.find(ns+'is')
                    val = ''
                    if v is not None and v.text is not None:
                        val = shared[int(v.text)] if t=='s' else v.text
                    elif ise is not None:
                        val = ''.join((tt.text or '') for tt in ise.iter(ns+'t'))
                    rows[ri][ci] = val
            sheets.append(rows)
        return sheets


def norm(s):
    return re.sub(r'[\s　]+', '', s or '').strip()


# 加载 master
with open(f'{REPO}/data/yolo-2025-members.master.json') as f:
    master = json.load(f)
name_to_uid = {norm(m['identity']['name']): m['identity']['userId'] for m in master['members']}
uid_to_name = {v: k for k, v in name_to_uid.items()}

# 加载当前 activities
with open(f'{REPO}/data/yolo-activities-collection.json') as f:
    col = json.load(f)
current_by_key = {a['activityKey']: a for a in col['activities']}

# 别名（xlsx 名 → master 标准名）
ALIAS = {
    '解凰尉': '解圓尉', '彭雨(彭唐心)': '彭唐心', '彭雨\n（彭唐心）': '彭唐心',
    'bill': '陈威全', 'BiLL': '陈威全', '陈嘉逸': None, '蔡之杰': None,
    '王睿翎': None,  # 不在 master
}


def resolve_uid(name):
    n = norm(name)
    if n in ALIAS:
        n = ALIAS[n]
        if n is None: return None
    return name_to_uid.get(n)


# === 解析所有源出席数据，构建 expected: {activityKey: set(uid)} ===
expected = {}

def add_expected(akey, uid):
    if not uid: return
    expected.setdefault(akey, set()).add(uid)

# 1. 新综合 出席表
combined = parse_xlsx(f'{DL}/YOLO+出席表.xlsx')
# sheet1 = 2025-2026 武夷山列 (col 3 = 武夷山, col 1 = 名字)
for ri in sorted(combined[0].keys()):
    if ri < 4: continue
    r = combined[0][ri]
    name = (r.get(1) or '').strip()
    if name in ('合计','序号','会员姓名'): continue
    if (r.get(3) or '').strip() in ('1','1.0'):
        uid = resolve_uid(name)
        if uid: add_expected('yolo-2026-wuyishan', uid)

# 2-6. 老年份 sheets
year_configs = [
    (1, 2022, ['yolo-2022-chengdu-07','yolo-2022-changsha-08','yolo-2022-hangzhou-09','yolo-2022-shanghai-11']),
    (2, 2021, ['yolo-2021-beijing-07','yolo-2021-online-09','yolo-2021-shanghai-10','yolo-2021-gba-11','yolo-2021-online-12','yolo-2021-online-02']),
    (3, 2020, ['yolo-2020-shenzhen-08','yolo-2020-beijing-09','yolo-2020-hangzhou-11']),
    (4, 2019, ['yolo-2019-taiwan-06','yolo-2019-france-08','yolo-2019-shenzhen-11','yolo-2019-hangzhou-12']),
]
for si, year, akeys in year_configs:
    sheet = combined[si]
    # 数据从 row 2 开始（row 0 = 标题, row 1 = 表头活动名）
    for ri in sorted(sheet.keys()):
        if ri < 2: continue
        r = sheet[ri]
        name = (r.get(1) or '').strip()
        if not name or name in ('合计','序号','姓名','会员姓名','现有会员','新增会员'): continue
        uid = resolve_uid(name)
        if not uid: continue
        # 活动列从 col 2 开始
        for i, akey in enumerate(akeys):
            v = (r.get(2+i) or '').strip()
            if v in ('1','1.0'): add_expected(akey, uid)

# 3. 2023, 2024, 2025 独立 xlsx
seps = [
    (f'{DL}/YOLO+会员活动出席表格/2023年YOLO+会员参与情况.xlsx', [
        (3, None, 'yolo-2023-hongkong'), (4, None, 'yolo-2023-japan'),
        (5, None, 'yolo-2023-chongqing'), (6, None, 'yolo-2024-shanghai-march'),
    ]),
    (f'{DL}/YOLO+会员活动出席表格/2024年YOLO+会员参与情况+角色登记.xlsx', [
        (3, 4, 'yolo-2024-shenzhen'), (5, 6, 'yolo-2024-singapore'),
        (7, 8, 'yolo-2024-macau'), (9, 10, 'yolo-2025-wenling'),
    ]),
    (f'{DL}/YOLO+会员活动出席表格/2025年YOLO+会员参与情况+角色登记.xlsx', [
        (3, 4, 'yolo-2025-yantai'), (5, 6, 'yolo-2025-zhengzhou'),
        (7, 8, 'yolo-2025-middleeast'), (9, 10, 'yolo-2025-suzhou'),
        (13, 14, 'yolo-2025-shanghai-group'), (15, 16, 'yolo-2025-guangdong-group'),
    ]),
]
for path, cols in seps:
    if not os.path.exists(path):
        print(f'⚠️ 跳过 {path} 不存在')
        continue
    sheet = parse_xlsx(path)[0]
    for ri in sorted(sheet.keys()):
        if ri < 4: continue
        r = sheet[ri]
        name = (r.get(1) or '').strip()
        if not name or name in ('合计','序号','姓名','会员姓名'): continue
        uid = resolve_uid(name)
        if not uid: continue
        for col_a, col_r, akey in cols:
            v = (r.get(col_a) or '').strip()
            if v in ('1','1.0'): add_expected(akey, uid)

# 4. 武夷山 CSV (覆盖 sheet1)
with open(f'{DL}/YOLO+出席表-2026武夷山小组活动.csv') as f:
    rows = list(csv.reader(f))
csv_wuyi = set()
for r in rows[4:]:
    if len(r) < 5: continue
    name = (r[1] or '').strip()
    if (r[3] or '').strip() in ('1','1.0'):
        uid = resolve_uid(name)
        if uid: csv_wuyi.add(uid)
if csv_wuyi:
    expected['yolo-2026-wuyishan'] = csv_wuyi  # CSV 更全

# === 对比 expected vs current_by_key ===
print(f'==== 活动出席审计（vs 源 xlsx）====')
print(f'  master uid: {len(name_to_uid)} | current activities: {len(current_by_key)} | expected keys: {len(expected)}')
print()

# 统计
total_expected = sum(len(v) for v in expected.values())
total_current = sum(len(a.get('participants',[])) for a in current_by_key.values())
print(f'expected 总出席: {total_expected} | current 总出席: {total_current}')
print()

mismatch_count = 0
for akey in sorted(set(list(expected.keys()) + list(current_by_key.keys()))):
    exp = expected.get(akey, set())
    cur_act = current_by_key.get(akey)
    cur = set(p['userId'] for p in (cur_act.get('participants', []) if cur_act else []))
    missing = exp - cur  # 应该有但没有
    extra = cur - exp    # 不该有但有
    if missing or extra:
        mismatch_count += 1
        title = cur_act['title'] if cur_act else '?'
        print(f'⚠️ {akey} | exp={len(exp)} cur={len(cur)} | {title}')
        if missing:
            print(f'  缺失 ({len(missing)}): ' + ', '.join(uid_to_name.get(u, u) for u in missing))
        if extra:
            print(f'  多余 ({len(extra)}): ' + ', '.join(uid_to_name.get(u, u) for u in extra))

if mismatch_count == 0:
    print('✅ 所有活动 expected vs current 完全一致')
else:
    print(f'\n共 {mismatch_count} 个活动有差异')
