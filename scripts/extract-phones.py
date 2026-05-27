#!/usr/bin/env python3
"""从 YOLO+档案信息表（全）.xlsx 所有 sheet 中提取每位成员的手机号（多个 → 数组）。

输出到 data/yolo-2025-members.master.json: 每个成员加 community.phones = [...]
"""
import xml.etree.ElementTree as ET
import re, zipfile, json, os

ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
DL = os.path.expanduser('~/Downloads')
ARCH = f'{DL}/YOLO+档案信息表（全）.xlsx'
REPO = '/Users/Sean/WeChatProjects/miniprogram-2'
MASTER = f'{REPO}/data/yolo-2025-members.master.json'

def col_to_idx(c):
    n=0
    for ch in c: n=n*26+(ord(ch)-ord('A')+1)
    return n-1
def parse_all(path):
    with zipfile.ZipFile(path) as z:
        with z.open('xl/sharedStrings.xml') as f:
            shared = [''.join((t.text or '') for t in si.iter(ns+'t')) for si in ET.parse(f).getroot().findall(ns+'si')]
        sf = sorted([n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')],
                    key=lambda x: int(re.search(r'sheet(\d+)', x).group(1)))
        out = []
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
            out.append(rows)
        return out

def norm_name(s):
    return re.sub(r'[\s　]+', '', s or '').strip()

# 任意字符串里挖手机号（11 位 1XX）
PHONE_RE = re.compile(r'(?<!\d)(1\d{10})(?!\d)')
def extract_phones(s):
    if not s: return []
    return PHONE_RE.findall(str(s))

# 加载 master
with open(MASTER, encoding='utf-8') as f:
    master = json.load(f)
known_names = set(norm_name(m['identity']['name']) for m in master['members'])

# 扫 sheets，对每行找姓名列 + 手机号列
sheets = parse_all(ARCH)
phones_by_name = {}  # name → set(phone)

def scan(sheet, name_cols, phone_cols, start_row=1):
    for ri in sorted(sheet.keys()):
        if ri < start_row: continue
        r = sheet[ri]
        name = ''
        for nc in name_cols:
            v = norm_name(r.get(nc, ''))
            if v and v in known_names:
                name = v; break
        if not name: continue
        for pc in phone_cols:
            phones = extract_phones(r.get(pc, ''))
            for p in phones:
                phones_by_name.setdefault(name, set()).add(p)
        # 备份扫描所有 cell（万一手机号在意外列）
        for ci, v in r.items():
            if ci in phone_cols: continue
            for p in extract_phones(v):
                phones_by_name.setdefault(name, set()).add(p)

# sheet1: name=col1, no phone col, but scan all
scan(sheets[0], [1], [], start_row=2)
# sheet2: name=col1, phone=col22
scan(sheets[1], [1], [22], start_row=2)
# sheet3: name=col1, phone=col3 (or col14)
scan(sheets[2], [1], [3, 14], start_row=1)
# sheet5: name=col1, phone=col16
scan(sheets[4], [1], [16], start_row=2)
# sheet6: name=col2, phone=col21
scan(sheets[5], [2], [21], start_row=1)
# sheet7-11: similar
for si in (6, 7, 8, 9, 10):
    try: scan(sheets[si], [1, 2], [21, 22], start_row=2)
    except: pass
# sheet12: name=col3, phone=col17
try: scan(sheets[11], [3], [17], start_row=1)
except: pass
# sheet13: name=col2, phone=col10
try: scan(sheets[12], [2], [10], start_row=1)
except: pass
# sheet14: name=col1, phone=col10
try: scan(sheets[13], [1], [10], start_row=2)
except: pass

# 写入 master
total_phones = 0
for m in master['members']:
    name = norm_name(m['identity']['name'])
    phones = sorted(phones_by_name.get(name, []))
    m['community']['phones'] = phones
    if phones: total_phones += len(phones)

with open(MASTER, 'w', encoding='utf-8') as f:
    json.dump(master, f, ensure_ascii=False, indent=2)

# 报告
print(f'共提取手机号: {total_phones}')
print(f'有手机号的会员: {sum(1 for m in master["members"] if m["community"].get("phones"))} / {len(master["members"])}')
print()
print('--- 每个会员的手机号 ---')
for m in master['members']:
    name = m['identity']['name']
    phones = m['community'].get('phones', [])
    print(f'  {name:<8} ({len(phones)}) : {", ".join(phones) if phones else "❌ 缺"}')
