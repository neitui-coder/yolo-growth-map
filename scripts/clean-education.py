#!/usr/bin/env python3
"""清洗 education 字段：只留学校名（多个学校并列），去地点、去学位、去专业。"""
import json
import re

import xml.etree.ElementTree as ET
import zipfile
import os

REPO = '/Users/Sean/WeChatProjects/miniprogram-2'
MASTER = f'{REPO}/data/yolo-2025-members.master.json'
ARCH = os.path.expanduser('~/Downloads/YOLO+档案信息表（全）.xlsx')
ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def col_to_idx(c):
    n=0
    for ch in c: n=n*26+(ord(ch)-ord('A')+1)
    return n-1

def parse_sheet(path, sheet_idx):
    with zipfile.ZipFile(path) as z:
        with z.open('xl/sharedStrings.xml') as f:
            shared = [''.join((t.text or '') for t in si.iter(ns+'t')) for si in ET.parse(f).getroot().findall(ns+'si')]
        sheet_files = sorted([n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')], key=lambda x: int(re.search(r'sheet(\d+)', x).group(1)))
        with z.open(sheet_files[sheet_idx]) as f: root = ET.parse(f).getroot()
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

# 从 xlsx sheet2 col 15 = 学习经历 重新读
detail = parse_sheet(ARCH, 1)  # sheet2 (0-indexed 1)
fresh_edu = {}
for ri, r in detail.items():
    if ri < 2: continue
    name = re.sub(r'[\s　]+', '', r.get(1,'') or '').strip()
    edu = (r.get(15) or '').strip()
    if name and edu:
        fresh_edu[name] = edu

COUNTRIES = ['中国', '美国', '英国', '澳大利亚', '加拿大', '日本', '韩国', '法国', '德国',
             '意大利', '新加坡', '马来西亚', '泰国', '荷兰', '瑞士', '俄罗斯', '香港', '台湾', '澳门']
# 仅当地点单独出现（不是学校名一部分）才剥离
CITIES_TRAIL = ['上海', '北京', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆', '武汉',
                '青岛', '宁波', '厦门', '天津', '西安', '长沙', '伦敦', '纽约', '波士顿', '芝加哥',
                '洛杉矶', '旧金山', '西雅图', '华盛顿', '墨尔本', '悉尼', '布里斯班', '多伦多',
                '温哥华', '蒙特利尔', '罗德岛', '普罗维登斯', '雪城', '雪梨']
SPECIALTIES = ['国际关系', '金融', '经济', '管理学', '计算机', '数据科学', '工业设计',
               '心理学', '建筑', '法学', '新闻', '传媒', '会计', '艺术', '设计',
               '人力资源', '市场营销', '机械工程', '电子工程', '生物学', '化学', '物理',
               '英语', '商科', '统计', '哲学', '历史', '社会学', '政治学']
STAGES = ['大一', '大二', '大三', '大四', '研一', '研二', '博一', '博二', '硕一', '硕二']


def has_cjk(s): return bool(re.search(r'[一-鿿]', s))
def has_eng(s): return bool(re.search(r'[A-Za-z]{4,}', s))


def clean_one(seg):
    s = (seg or '').strip()
    if not s: return ''
    # 1. 去括号内容
    s = re.sub(r'[（(][^）)]*[)）]', '', s)
    # 2. 去前缀 "本科：" "硕士：" "研究生：" 等
    s = re.sub(r'^(本科|研究生|硕士|博士|学士|专科|大专|高中)[：:]\s*', '', s)
    # 3. 去 "专业：xxx" 后缀
    s = re.sub(r'\s*[,，]?\s*专业[：:].*', '', s)
    # 4. 去学位英文 "Bachelor of XXX" "Master of XXX" 等（保留学校名）
    s = re.sub(r'\s*[,，]\s*(Bachelor|Master|PhD|Ph\.D|MBA|BA|BS|BSc|MA|MS|MSc)\b[^,，]*', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\s+(Bachelor|Master|PhD|Ph\.D|MBA)\b[^,，]*$', '', s, flags=re.IGNORECASE)
    # 5. 去尾部 "学士/硕士/博士/双学位" 等
    s = re.sub(r'\s*(学士学位|硕士学位|博士学位|双学位|双主修|主修|辅修)[^A-Za-z]*$', '', s)
    s = re.sub(r'\s*在读\s*$', '', s)
    # 6. 去尾部学习阶段 "大一/大二/大三/大四"
    for stg in STAGES:
        s = re.sub(r'\s*[,，]?\s*' + stg + r'\s*$', '', s)
    # 7. 去尾部专业名（仅明确的）
    for sp in SPECIALTIES:
        s = re.sub(r'\s+' + sp + r'(?:学)?\s*$', '', s)
    s = re.sub(r'\s*[,，]\s*[一-鿿]{2,4}系\s*$', '', s)  # "金融系" 这种
    s = re.sub(r'\s+[一-鿿]{2,4}系\s*$', '', s)
    # 8. 去开头国家前缀（仅前缀）
    for c in COUNTRIES:
        if s.startswith(c):
            s = s[len(c):].lstrip(' ,，;；-、')
            break
    # 9. 中英混合 → 优先英文
    if has_cjk(s) and has_eng(s):
        # 找英文学校名模式
        m = re.search(r'([A-Z][A-Za-z][A-Za-z\s&\'\-,./]*(?:University|College|School|Institute|Academy|Polytechnic)[A-Za-z\s&\'\-,./]*)', s)
        if m:
            s = m.group(1).strip(' ,.&-')
        else:
            # 取最长英文片段
            eng = re.findall(r'[A-Z][A-Za-z\s&\'\-]{3,}', s)
            if eng: s = max(eng, key=len).strip(' ,.&-')
    # 10. 城市前缀 + 英文（"墨尔本 Monash University"）
    m = re.match(r'^([一-鿿]+)\s+([A-Z][A-Za-z\s&\'\-,./]+)$', s)
    if m: s = m.group(2).strip(' ,.&-')
    # 11. 单独 CJK 形如 "城市 学校" 拆开 -- 风险大，保守不做
    # 12. 收尾
    s = re.sub(r'\s+', ' ', s).strip(' ,，;；./-')
    return s


def clean_education(raw):
    if not raw: return ''
    # 主分隔：换行 / 分号 / 顿号 / "和"
    segs = re.split(r'[\n;；、]+|\s+和\s+', raw)
    out = []
    for seg in segs:
        c = clean_one(seg)
        if c and c not in out:
            out.append(c)
    return ' / '.join(out)


# 测试
samples = [
    ('美国布朗大学（经济学、社会学）', '布朗大学'),
    ('澳大利亚墨尔本 Monash University, Bachelor of Commerce', 'Monash University'),
    ('Syracuse University 美国雪城大学\n双主修：创业创新学系 和 国际关系学', 'Syracuse University'),
    ('本科：美国加州大学圣地亚哥分校 专业： 数据科学\n研究生：UCSD Data Science UCB IEOR', '加州大学圣地亚哥分校 / UCSD ...'),
    ('英国皇家中央演讲与戏剧学院-实验戏剧', '皇家中央演讲与戏剧学院'),
    ('加拿大多伦多大学 金融系', '多伦多大学'),
    ('旧金山大学金融专业大四', '旧金山大学'),
    ('杜兰大学，大二 国际关系 计划再辅修', '杜兰大学'),
]
print('=== 测试 ===')
for raw, expected in samples:
    got = clean_education(raw)
    ok = '✅' if got == expected or expected.endswith('...') else '⚠️'
    print(f'  {ok} IN : {raw[:60]}')
    print(f'     OUT: {got}')
    print(f'     EXP: {expected}')
    print()

# 全量：从 xlsx fresh education 重新清洗
def norm(s): return re.sub(r'[\s　]+', '', s or '').strip()

with open(MASTER, encoding='utf-8') as f:
    master = json.load(f)
print('=== 全量清洗（数据从 xlsx 重读）===')
for m in master['members']:
    name = m['identity']['name']
    fresh = fresh_edu.get(norm(name), '')
    if not fresh: continue
    new = clean_education(fresh)
    m['profile']['education'] = new
    print(f'  {name:<8} → {new}')

with open(MASTER, 'w', encoding='utf-8') as f:
    json.dump(master, f, ensure_ascii=False, indent=2)
print('\nDone')
