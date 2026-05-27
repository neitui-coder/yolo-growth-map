#!/usr/bin/env python3
"""清洗 company 字段：从 xlsx 工作经历取最新公司，去日期，缩短长名。"""
import xml.etree.ElementTree as ET
import re, zipfile, json, os

ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
REPO = '/Users/Sean/WeChatProjects/miniprogram-2'
MASTER = f'{REPO}/data/yolo-2025-members.master.json'
ARCH = os.path.expanduser('~/Downloads/YOLO+档案信息表（全）.xlsx')

def col_to_idx(c):
    n=0
    for ch in c: n=n*26+(ord(ch)-ord('A')+1)
    return n-1
def parse_sheet(path, idx):
    with zipfile.ZipFile(path) as z:
        with z.open('xl/sharedStrings.xml') as f:
            shared = [''.join((t.text or '') for t in si.iter(ns+'t')) for si in ET.parse(f).getroot().findall(ns+'si')]
        sf = sorted([n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')], key=lambda x: int(re.search(r'sheet(\d+)', x).group(1)))
        with z.open(sf[idx]) as f: root = ET.parse(f).getroot()
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
    return rows
def norm(s): return re.sub(r'[\s　]+', '', s or '').strip()

DATE_PFX = re.compile(r'^[\d]{4}[\.\/年\-][\d]{1,2}[月]?(\s*[\-至到~]\s*([\d]{4}[\.\/年\-]?[\d]{1,2}?[月]?|至今|今|present))?\s*')

SHORT_REPLACE = [
    ('股份有限公司', ''), ('有限公司', ''), ('有限责任公司', ''),
    ('股份公司', ''), ('集团有限公司', '集团'), ('科技有限公司', '科技'),
    ('（', '('), ('）', ')'),
]

def shorten(name):
    s = name.strip()
    for a, b in SHORT_REPLACE:
        s = s.replace(a, b)
    s = re.sub(r'\s+', ' ', s).strip(' ,，;；./-')
    # 配对括号
    if s.count('(') > s.count(')'):
        s += ')' * (s.count('(') - s.count(')'))
    if s.count(')') > s.count('('):
        s = '(' * (s.count(')') - s.count('(')) + s
    # 太长截 16 字（更短）
    if len(s) > 16:
        s = s[:16] + '…'
    return s

def clean_one(raw):
    s = (raw or '').strip()
    if not s or s in ('/', '\\', '-', '—', '无', '暂无', 'N/A', 'NA'): return ''
    # 去前缀日期
    s = DATE_PFX.sub('', s)
    s = re.sub(r'^\s*[\-—~]+\s*', '', s)
    return s.strip()

def clean_company(raw):
    if not raw: return ''
    raw = raw.replace('\r', '\n')
    # split by / or 、 or newline
    parts = re.split(r'[/／、\n]+', raw)
    cleaned = []
    for p in parts:
        c = clean_one(p)
        if c and not DATE_PFX.match(c):  # 跳过纯日期
            # 去尾部时间范围如 "2020.4-"
            c = re.sub(r'\s*[\d]{4}[\.\/年\-][\d]{1,2}[月]?\s*[\-至到~]?\s*$', '', c).strip()
            if c: cleaned.append(c)
    if not cleaned: return ''
    # 取最后一个（最新）
    return shorten(cleaned[-1])

# 测试
samples = [
    ('2018.1-2019.5 Meltwater/ 2020.4- 鲨湾科技', '鲨湾科技'),
    ('天合资本管理公司', '天合资本管理'),
    ('/', ''),
    ('飞越真空科技', '飞越真空科技'),
    ('北京超线性', '北京超线性'),
    ('浙江中兴精密工业集团有限公司 宁波瑞之缘食品有限公司', '?'),
]
print('=== test ===')
for raw, exp in samples:
    print(f'  IN : {raw[:50]:<50} → {clean_company(raw)}')

# 从 xlsx sheet2 col 16 重新读
detail = parse_sheet(ARCH, 1)
fresh = {}
for ri, r in detail.items():
    if ri < 2: continue
    n = norm(r.get(1, ''))
    if n: fresh[n] = (r.get(16) or '').strip()

with open(MASTER, encoding='utf-8') as f:
    master = json.load(f)
print('\n=== 全量 ===')
for m in master['members']:
    name = m['identity']['name']
    raw = fresh.get(norm(name), '')
    new = clean_company(raw)
    old = m['profile'].get('company', '')
    if old != new:
        print(f'  {name:<8} {old[:30]:<30} → {new}')
    m['profile']['company'] = new

with open(MASTER, 'w', encoding='utf-8') as f:
    json.dump(master, f, ensure_ascii=False, indent=2)
print('\nDone')
