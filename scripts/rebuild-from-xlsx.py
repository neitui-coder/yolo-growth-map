#!/usr/bin/env python3
"""从 Sean 提供的官方 xlsx 全量重建会员 + 活动出席。

数据源：
  ~/Downloads/YOLO+档案信息表（全）.xlsx       — 会员综合档案
  ~/Downloads/YOLO+出席表.xlsx               — 多年度活动出席

规则：
  - 保留：含"理事"职务 ∪ 加入年份 ≥ 2022
  - 字段（小程序展示）：姓名 / MBTI / 盖洛普 / 兴趣 / 公司 / 城市 / 生日(月) / 教育
  - MBTI/Gallup/Hobbies 优先 xlsx；空则 fallback 旧 master（PDF 海报）
  - 加入时长：current_year - joinYear（"X 年"）
  - 头像/英文名/父母信息 全部去除

输出：
  data/yolo-2025-members.master.json
  data/yolo-activities-collection.json （仅当 attendance 解析成功）
"""
import xml.etree.ElementTree as ET
import re
import zipfile
import json
import os
import sys
from datetime import datetime, timedelta

DL = os.path.expanduser('~/Downloads')
ARCH_PATH = f'{DL}/YOLO+档案信息表（全）.xlsx'
ATT_PATH = f'{DL}/YOLO+出席表.xlsx'
REPO = '/Users/Sean/WeChatProjects/miniprogram-2'
MASTER_OUT = f'{REPO}/data/yolo-2025-members.master.json'
ACT_OUT = f'{REPO}/data/yolo-activities-collection.json'
OLD_MASTER = f'{REPO}/data/yolo-2025-members.master.json'

ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
CURRENT_YEAR = datetime.now().year

MBTI_RE = re.compile(r'(?:INFP|INFJ|INTP|INTJ|ISTP|ISTJ|ISFP|ISFJ|ENFP|ENFJ|ENTP|ENTJ|ESTP|ESTJ|ESFP|ESFJ)(?:-[AT])?')


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


def clean_text(s):
    """trim + 合并多行 + 多空格归一"""
    if not s:
        return ''
    s = s.replace('\r', '').replace('\n', ' ').strip()
    return re.sub(r'\s+', ' ', s)


def excel_serial_to_year(v):
    if not v:
        return None
    try:
        days = int(float(v))
        dt = datetime(1899, 12, 30) + timedelta(days=days)
        return dt.year
    except (ValueError, TypeError):
        m = re.match(r'(\d{4})', str(v))
        if m:
            return int(m.group(1))
        return None


def first_city(s):
    if not s:
        return ''
    # 去除括号内补充
    s = re.sub(r'[（(].*?[)）]', '', s).strip()
    parts = re.split(r'[,，;；/]', s)
    last = (parts[0] or '').strip()
    if last in ('中国', '国内', 'China', '中国大陆'):
        last = (parts[1] if len(parts) > 1 else parts[0]).strip()
    last = re.split(r'[、,，;；/ ]', last)[0].strip()
    return last


# ─── 解析档案 xlsx ─────────────────────────────────────────────────────────────
archive = parse_xlsx_all_sheets(ARCH_PATH)
print(f'档案 xlsx 共 {len(archive)} sheet')

master_sheet = archive[0]  # sheet1 综合
detail_sheet = archive[1]  # sheet2 详细
roster_sheet = archive[5]  # sheet6 2025-2026 年度名单 (权威现届列表，34 人)


def build_roster_status():
    """sheet6: col 1 类别(现届会员/新增会员/往届会员), col 2 姓名 → {name: status}"""
    out = {}
    for ri in sorted(roster_sheet.keys()):
        if ri < 1: continue
        r = roster_sheet[ri]
        cat = (r.get(1) or '').strip()
        name = norm(r.get(2) or '')
        if not name or name in ('序号', '姓名'): continue
        if cat in ('现届会员', '新增会员'):
            out[name] = 'active'
        elif cat == '往届会员':
            out[name] = 'alumni'
    return out


roster_status = build_roster_status()
print(f'sheet6 年度名单：{len(roster_status)} 人 ({sum(1 for v in roster_status.values() if v=="active")} active + {sum(1 for v in roster_status.values() if v=="alumni")} alumni)')


def build_detail_index():
    idx = {}
    for ri in sorted(detail_sheet.keys()):
        if ri < 2:
            continue
        r = detail_sheet[ri]
        name = norm(r.get(1) or '')
        if not name or name in ('合计', '类别', '序号', '会员姓名'):
            continue
        idx[name] = r
    return idx


detail_by_name = build_detail_index()


# ─── 加载旧 master（PDF 海报）作为 MBTI/Gallup/兴趣 兜底 ──────────────────────
old_members_by_name = {}
try:
    with open(OLD_MASTER, encoding='utf-8') as f:
        old = json.load(f)
    for m in old.get('members', []):
        name = norm(m.get('identity', {}).get('name') or '')
        if name:
            old_members_by_name[name] = m
    print(f'旧 master 加载：{len(old_members_by_name)} 人（用于 MBTI/Gallup 兜底）')
except FileNotFoundError:
    print('旧 master 不存在，跳过兜底')


# ─── 全量姓名 → userId 映射（兼容历史） ─────────────────────────────────────
def assign_user_id(name, member_no, fallback_idx):
    """优先用旧 master 的 userId（保持兼容）；其次用会员号；最后用 fallback 索引"""
    old = old_members_by_name.get(name)
    if old:
        uid = old.get('identity', {}).get('userId')
        if uid:
            return uid
    if member_no:
        return f'mn-{member_no}'
    return f'm-{fallback_idx:03d}'


# ─── 构建会员 ─────────────────────────────────────────────────────────────────
members = []
skipped = []
for ri in sorted(master_sheet.keys()):
    if ri < 2:
        continue
    r = master_sheet[ri]
    name = norm(r.get(1) or '')
    if not name or name in ('合计', '类别', '序号', '会员姓名'):
        continue
    member_no = (r.get(4) or '').strip()
    category = (r.get(5) or '').strip()
    role_title = clean_text(r.get(6) or '')
    join_year = excel_serial_to_year(r.get(3))

    d = detail_by_name.get(name, {})
    birthday_month = (d.get(11) or r.get(12) or '').strip()
    company_raw = clean_text(d.get(16) or '')
    company = company_raw.split(' ')[0]
    # 过滤明显无效占位（"/", "无", "-", "暂无" 等）
    if company in ('/', '无', '-', '暂无', '空', 'N/A', 'NA', '/', '\\'):
        company = ''
    city_raw = clean_text(d.get(18) or '')
    hobbies_raw = clean_text(d.get(21) or '')
    gallup_raw = clean_text(d.get(26) or '')
    mbti_raw = clean_text(d.get(27) or '')
    edu_school = clean_text(d.get(15) or '')
    edu_degree = clean_text(d.get(14) or '')

    city = first_city(city_raw)

    bm = re.match(r'^\d+', birthday_month)
    birthday_display = f'{int(bm.group(0))}月' if bm and 1 <= int(bm.group(0)) <= 12 else ''

    hobbies = [h.strip() for h in re.split(r'[、,，┋;；/]', hobbies_raw) if h.strip()]
    gallup = [g.strip() for g in re.split(r'[/、,，┋]', gallup_raw) if g.strip()]
    mbti = ''
    m_mbti = MBTI_RE.search(mbti_raw)
    if m_mbti:
        mbti = m_mbti.group(0)

    # 兜底：从旧 master 拿
    old = old_members_by_name.get(name) or {}
    if not mbti:
        old_p = old.get('profile', {})
        # 旧数据 MBTI 可能在 profile.mbti 或散落
        for k in ('mbti', 'MBTI'):
            v = old_p.get(k) or old.get(k) or ''
            mm = MBTI_RE.search(str(v))
            if mm:
                mbti = mm.group(0)
                break
        if not mbti:
            # 全量 stringify search
            mm = MBTI_RE.search(json.dumps(old, ensure_ascii=False))
            if mm:
                mbti = mm.group(0)
    if not gallup:
        gallup = (old.get('profile') or {}).get('gallup') or []
    if not hobbies:
        hobbies = (old.get('interests') or {}).get('hobbies') or []

    is_lishi = '理事' in role_title
    in_roster = name in roster_status
    # 最终规则：以 sheet6（2025-2026 年度名单 34 人）为权威现届，
    # 加上所有未在名单的理事（5 位创始理事补回）
    keep = in_roster or is_lishi
    if not keep:
        skipped.append((name, join_year, role_title))
        continue

    duration_years = max(0, CURRENT_YEAR - join_year) if join_year else None
    user_id = assign_user_id(name, member_no, len(members))

    # member status: 优先 sheet6 年度名单；否则 fallback 到 类别 大小写
    if name in roster_status:
        is_alumni = (roster_status[name] == 'alumni')
    else:
        is_alumni = category in ('w', 's')

    avatar_image = (old.get('assets') or {}).get('avatarImage') or ''

    members.append({
        'memberStatus': 'alumni' if is_alumni else 'active',
        'identity': {
            'userId': user_id,
            'name': name,
            # 注意：英文名按 Sean 要求不展示，但保留用于内部兼容
            'englishName': (r.get(2) or '').strip()
        },
        'community': {
            'role': role_title,
            'isLishi': is_lishi,
            'memberNo': member_no,
            'category': category,
            'joinYear': join_year,
            'durationYears': duration_years,
            'joinDate': f'{join_year}-01' if join_year else None,
            'joinPeriods': [{'start': f'{join_year}-01', 'end': None}] if join_year else []
        },
        'profile': {
            'mbti': mbti,
            'gallup': gallup,
            'company': company,
            'city': city,
            'birthday': birthday_display,  # 仅月份格式（如 "6月"），无日数据
            'education': edu_school,
            'educationDegree': edu_degree,
            'motto': (old.get('profile') or {}).get('motto') or ''
        },
        'interests': {
            'hobbies': hobbies
        },
        'assets': {'avatarImage': avatar_image} if avatar_image else {},
        'import': {'dataType': 'real', 'source': 'official-xlsx-2026-05'}
    })

print(f'\n=== 筛选后：{len(members)} 人 ===')
print(f'  理事：{sum(1 for m in members if m["community"]["isLishi"])}')
print(f'  现届(W/S)：{sum(1 for m in members if m["memberStatus"]=="active")}')
print(f'  往届(w/s)：{sum(1 for m in members if m["memberStatus"]=="alumni")}')

# 字段覆盖统计
def cov(field_path):
    n = 0
    for m in members:
        cur = m
        ok = True
        for k in field_path.split('.'):
            cur = cur.get(k) if isinstance(cur, dict) else None
            if cur is None:
                ok = False
                break
        if ok and (cur if not isinstance(cur, list) else len(cur)):
            n += 1
    return n
print(f'\n字段覆盖（含 PDF 兜底）：')
print(f'  MBTI: {cov("profile.mbti")}/{len(members)}')
print(f'  Gallup: {cov("profile.gallup")}/{len(members)}')
print(f'  Hobbies: {cov("interests.hobbies")}/{len(members)}')
print(f'  Company: {cov("profile.company")}/{len(members)}')
print(f'  City: {cov("profile.city")}/{len(members)}')
print(f'  Birthday: {cov("profile.birthday")}/{len(members)}')
print(f'  Education: {cov("profile.education")}/{len(members)}')

# ─── 写出 master ───────────────────────────────────────────────────────────────
out = {
    'schemaVersion': 2,
    'generatedAt': datetime.now().isoformat(),
    'source': 'YOLO+档案信息表（全）.xlsx',
    'rules': {
        'keep': '理事∪joinYear>=2022',
        'displayFields': ['name', 'mbti', 'gallup', 'hobbies', 'company', 'city', 'birthdayMonth', 'education']
    },
    'members': members
}
with open(MASTER_OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f'\nwrote {MASTER_OUT}')
print(f'  ({len(skipped)} skipped — 非理事且 < 2022 加入)')
