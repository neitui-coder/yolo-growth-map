#!/usr/bin/env python3
"""按会员维度审计：对每个 37 人，列出
1. 源 xlsx 中他/她应参加的活动
2. 当前 collection 里他/她出现的活动
3. 差异
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

with open(f'{REPO}/data/yolo-2025-members.master.json') as f:
    master = json.load(f)
name_to_uid = {norm(m['identity']['name']): m['identity']['userId'] for m in master['members']}
uid_to_name = {v: k for k, v in name_to_uid.items()}

with open(f'{REPO}/data/yolo-activities-collection.json') as f:
    col = json.load(f)

ALIAS = {'解凰尉':'解圓尉','彭雨(彭唐心)':'彭唐心','彭雨\n（彭唐心）':'彭唐心','bill':'陈威全','BiLL':'陈威全'}
def resolve_uid(name):
    n = norm(name)
    if n in ALIAS: n = ALIAS[n]
    if n is None: return None
    return name_to_uid.get(n)

# expected per user
exp_by_uid = {}  # uid → set(akey)
def add(uid, akey):
    if uid: exp_by_uid.setdefault(uid, set()).add(akey)

combined = parse_xlsx(f'{DL}/YOLO+出席表.xlsx')
for ri in sorted(combined[0].keys()):
    if ri < 4: continue
    r = combined[0][ri]; name = (r.get(1) or '').strip()
    if (r.get(3) or '').strip() in ('1','1.0'): add(resolve_uid(name), 'yolo-2026-wuyishan')

ycfg = [
    (1, ['yolo-2022-chengdu-07','yolo-2022-changsha-08','yolo-2022-hangzhou-09','yolo-2022-shanghai-11']),
    (2, ['yolo-2021-beijing-07','yolo-2021-online-09','yolo-2021-shanghai-10','yolo-2021-gba-11','yolo-2021-online-12','yolo-2021-online-02']),
    (3, ['yolo-2020-shenzhen-08','yolo-2020-beijing-09','yolo-2020-hangzhou-11']),
    (4, ['yolo-2019-taiwan-06','yolo-2019-france-08','yolo-2019-shenzhen-11','yolo-2019-hangzhou-12']),
]
for si, akeys in ycfg:
    for ri in sorted(combined[si].keys()):
        if ri < 2: continue
        r = combined[si][ri]; name = (r.get(1) or '').strip()
        if not name or name in ('合计','序号','姓名','现有会员','新增会员'): continue
        uid = resolve_uid(name)
        for i, akey in enumerate(akeys):
            if (r.get(2+i) or '').strip() in ('1','1.0'): add(uid, akey)

seps = [
    (f'{DL}/YOLO+会员活动出席表格/2023年YOLO+会员参与情况.xlsx', [
        (3, 'yolo-2023-hongkong'),(4,'yolo-2023-japan'),(5,'yolo-2023-chongqing'),(6,'yolo-2024-shanghai-march'),
    ]),
    (f'{DL}/YOLO+会员活动出席表格/2024年YOLO+会员参与情况+角色登记.xlsx', [
        (3,'yolo-2024-shenzhen'),(5,'yolo-2024-singapore'),(7,'yolo-2024-macau'),(9,'yolo-2025-wenling'),
    ]),
    (f'{DL}/YOLO+会员活动出席表格/2025年YOLO+会员参与情况+角色登记.xlsx', [
        (3,'yolo-2025-yantai'),(5,'yolo-2025-zhengzhou'),(7,'yolo-2025-middleeast'),(9,'yolo-2025-suzhou'),
        (13,'yolo-2025-shanghai-group'),(15,'yolo-2025-guangdong-group'),
    ]),
]
for path, cols in seps:
    if not os.path.exists(path): continue
    sheet = parse_xlsx(path)[0]
    for ri in sorted(sheet.keys()):
        if ri < 4: continue
        r = sheet[ri]; name = (r.get(1) or '').strip()
        if not name or name in ('合计','序号','姓名'): continue
        uid = resolve_uid(name)
        for col_a, akey in cols:
            if (r.get(col_a) or '').strip() in ('1','1.0'): add(uid, akey)

# 武夷山 CSV 覆盖
with open(f'{DL}/YOLO+出席表-2026武夷山小组活动.csv') as f:
    rows = list(csv.reader(f))
csv_wuyi = set()
for r in rows[4:]:
    if len(r) < 5: continue
    name = (r[1] or '').strip()
    if (r[3] or '').strip() in ('1','1.0'):
        uid = resolve_uid(name)
        if uid: csv_wuyi.add(uid)
# 覆盖 wuyi expectation
for uid in list(exp_by_uid.keys()):
    exp_by_uid[uid].discard('yolo-2026-wuyishan')
for uid in csv_wuyi:
    exp_by_uid.setdefault(uid, set()).add('yolo-2026-wuyishan')

# current per uid
cur_by_uid = {}
for a in col['activities']:
    for p in (a.get('participants') or []):
        cur_by_uid.setdefault(p['userId'], set()).add(a['activityKey'])

# 比对
print(f'{"姓名":<10} {"应参加":>6} {"当前":>4} {"差异"}')
print('-' * 60)
mismatch = 0
for m in master['members']:
    uid = m['identity']['userId']
    name = m['identity']['name']
    exp = exp_by_uid.get(uid, set())
    cur = cur_by_uid.get(uid, set())
    miss = exp - cur
    extra = cur - exp
    diff = ''
    if miss: diff += f'缺{len(miss)}:' + ','.join(sorted(miss)) + ' '
    if extra: diff += f'多{len(extra)}:' + ','.join(sorted(extra))
    if miss or extra:
        mismatch += 1
        print(f'{name:<10} {len(exp):>6} {len(cur):>4}  {diff}')
    else:
        print(f'{name:<10} {len(exp):>6} {len(cur):>4}  ✅')
print(f'\n差异会员数: {mismatch}/{len(master["members"])}')
