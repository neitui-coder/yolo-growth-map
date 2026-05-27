#!/usr/bin/env python3
"""从档案 xlsx 多 sheet 提取每位会员的 MBTI（Excel 优先，PDF 兜底已在 master）。"""
import xml.etree.ElementTree as ET
import re, zipfile, json, os

ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
DL = os.path.expanduser('~/Downloads')
ARCH = f'{DL}/YOLO+档案信息表（全）.xlsx'
REPO = '/Users/Sean/WeChatProjects/miniprogram-2'
MASTER = f'{REPO}/data/yolo-2025-members.master.json'
MBTI_RE = re.compile(r'\b(INFP|INFJ|INTP|INTJ|ISTP|ISTJ|ISFP|ISFJ|ENFP|ENFJ|ENTP|ENTJ|ESTP|ESTJ|ESFP|ESFJ)(?:-[AT])?\b')

def col_to_idx(c):
    n=0
    for ch in c: n=n*26+(ord(ch)-ord('A')+1)
    return n-1

def parse_all(path):
    with zipfile.ZipFile(path) as z:
        with z.open('xl/sharedStrings.xml') as f:
            shared = [''.join((t.text or '') for t in si.iter(ns+'t')) for si in ET.parse(f).getroot().findall(ns+'si')]
        sf = sorted([n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')], key=lambda x: int(re.search(r'sheet(\d+)', x).group(1)))
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

def norm(s): return re.sub(r'[\s　]+', '', s or '').strip()

with open(MASTER, encoding='utf-8') as f:
    master = json.load(f)
known = {norm(m['identity']['name']) for m in master['members']}

# 扫所有 sheet，对每行找 name + MBTI
mbti_by_name = {}
sheets = parse_all(ARCH)
for si, sheet in enumerate(sheets):
    for ri, r in sheet.items():
        # 找 name (col 1 or 2)
        name = ''
        for nc in [1, 2, 3]:
            v = norm(r.get(nc, ''))
            if v in known:
                name = v; break
        if not name: continue
        # 全行扫 MBTI 关键字
        for ci, v in r.items():
            mm = MBTI_RE.search(str(v))
            if mm:
                # 不要覆盖已有的（Excel 优先：先扫到的优先）
                mbti_by_name.setdefault(name, mm.group(0))
                break

# 写回 master
updated = 0
for m in master['members']:
    name = norm(m['identity']['name'])
    xlsx_mbti = mbti_by_name.get(name)
    if xlsx_mbti and m['profile'].get('mbti') != xlsx_mbti:
        old = m['profile'].get('mbti', '')
        m['profile']['mbti'] = xlsx_mbti
        updated += 1
        print(f'  {m["identity"]["name"]:<8} MBTI: "{old}" → "{xlsx_mbti}"')

with open(MASTER, 'w', encoding='utf-8') as f:
    json.dump(master, f, ensure_ascii=False, indent=2)

print()
print(f'更新 {updated} 个 MBTI')
final = sum(1 for m in master['members'] if m['profile'].get('mbti'))
print(f'最终覆盖：{final}/{len(master["members"])} 个会员有 MBTI')
no_mbti = [m['identity']['name'] for m in master['members'] if not m['profile'].get('mbti')]
print(f'缺失 ({len(no_mbti)}人): {", ".join(no_mbti)}')
