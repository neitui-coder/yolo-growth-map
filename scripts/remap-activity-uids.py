#!/usr/bin/env python3
"""把 activities collection 里的旧 userId (pdf2025-*) 重新映射到当前 master uid。

背景：rebuild-from-xlsx.py 用「会员号优先 (mn-*) > 旧 master uid (pdf2025-*)」分配 uid。
导致部分会员 uid 变了，但 activities.participants 还是老 pdf2025-* 形式 → buildNodes 匹配不上。

本脚本：name 反查映射 + 修正
"""
import json
import re

REPO = '/Users/Sean/WeChatProjects/miniprogram-2'
MASTER = f'{REPO}/data/yolo-2025-members.master.json'
ACT = f'{REPO}/data/yolo-activities-collection.json'

with open(MASTER, encoding='utf-8') as f:
    master = json.load(f)

# 当前 master {uid → name} 和 {name → uid}
current_uid_to_name = {}
name_to_current_uid = {}
for m in master['members']:
    uid = m['identity']['userId']
    name = m['identity']['name']
    current_uid_to_name[uid] = name
    name_to_current_uid[name] = uid

# 老 pdf2025-* slug → 姓名映射（基于历史 PDF 海报命名规律 + ALIASES）
# 当 activity 出现 pdf2025-xxx 时，知道该 xxx 对应哪个真人姓名
PDF_SLUG_TO_NAME = {
    'pdf2025-bill': '陈威全',
    'pdf2025-katherine': '高海纯',
    'pdf2025-rachel': '张瑞琪',
    'pdf2025-yueyue': '周玥',
    'pdf2025-jingzi': '蒋柳璟子',
    'pdf2025-sarah': '罗琦玥',
    'pdf2025-sean': '王骁',
    'pdf2025-zhiqian': '徐志谦',
    'pdf2025-p09': '邓礼睿',
    'pdf2025-monica': '吴梓萌',
    'pdf2025-peter': '吴昌鸿',
    'pdf2025-amber': '张嘉沁',
    'pdf2025-charles': '胡润卿',
    'pdf2025-janine': '艾佳宁',
    'pdf2025-rita': '林安之',
    'pdf2025-kevin': '高直方',
    'pdf2025-jiayu': '潘佳瑜',
    'pdf2025-xiaoyan': '范晓雁',
    'pdf2025-zhuofan': '詹卓凡',
    'pdf2025-jerry': '林海',
    'pdf2025-mat-so': '苏炜烔',
    'pdf2025-jiawei': '林佳炜',
    'pdf2025-wenxin': '宣文馨',
    'pdf2025-shenyin': '沈吟',
    'pdf2025-nara': '解圓尉',
    'pdf2025-lucy': '杭一璐',
    'pdf2025-jackson': '葛汉',
    'pdf2025-chloe': '彭唐心',
    'pdf2025-boyuan': '李博源',
    'pdf2025-sarah-p30': '高秋闲',
    'pdf2025-weiyun': '李维韵',
    'pdf2025-sophie': '苏雨',
    'pdf2025-jiatong': '高嘉瞳',
    'pdf2025-weijie': '毕伟杰',
    'pdf2025-linda': '陆怡霖',
    'pdf2025-dufresne': '陈其乐',
    'pdf2025-eco': '宗羱',
    'alumni-kingsley': '焦桢',
    'alumni-jiachen': '季佳琛',
    'alumni-yucheng': '纪域呈',
    'alumni-jinhua': '胡晋华',
    'alumni-xiaoyu': '胡晓钰',
    'alumni-xiaoxin': '杜晓欣',
    'alumni-yutong': '刘昱同',
    'alumni-jack': '金连成',
    'alumni-huixi': '朱慧溪',
    'alumni-saxi': '阮赛茜',
    'alumni-qingtong': '林青桐',
    'alumni-kaixing': '何楷行',
    'alumni-haocheng': '周浩铖',
    'alumni-yiping': '邵怡平',
    'alumni-huanglei': '黄蕾',
    'alumni-jiayi': '李嘉怡',
    'alumni-xiaoxuan': '陈晓萱',
    'alumni-siwen': '崔斯雯',
    'alumni-ruixiang': '王睿翔',
    'alumni-shijie': '苏世杰',
    'alumni-wangwang': '汪汪',
    'alumni-zherui': '张哲瑞',
    'alumni-shuni': '朱书妮',
    'alumni-yuxin': '姚语馨',
    'alumni-jinsha': '欧阳瑾莎',
    'alumni-yian': '邵怡安',
}


def resolve_to_current(old_uid):
    """旧 uid → 当前 master uid (或 None 表示已被过滤掉)"""
    if old_uid in current_uid_to_name:
        return old_uid  # 已经是当前 uid
    name = PDF_SLUG_TO_NAME.get(old_uid)
    if not name:
        return None
    return name_to_current_uid.get(name)


with open(ACT, encoding='utf-8') as f:
    col = json.load(f)

unchanged = changed = dropped = 0
unknown_uids = set()
for a in col['activities']:
    new_parts = []
    for p in (a.get('participants') or []):
        old = p['userId']
        cur = resolve_to_current(old)
        if cur is None:
            if old not in current_uid_to_name and old not in PDF_SLUG_TO_NAME:
                unknown_uids.add(old)
            dropped += 1
            continue
        if cur == old:
            unchanged += 1
        else:
            changed += 1
        new_parts.append({'userId': cur, 'role': p.get('role', '')})
    # 去重（按 userId）
    seen = set()
    dedup = []
    for p in new_parts:
        if p['userId'] in seen: continue
        seen.add(p['userId'])
        dedup.append(p)
    a['participants'] = dedup

with open(ACT, 'w', encoding='utf-8') as f:
    json.dump(col, f, ensure_ascii=False, indent=2)

print(f'remap 完成：unchanged={unchanged} changed={changed} dropped={dropped}')
if unknown_uids:
    print(f'未识别 uid（已丢弃）: {unknown_uids}')

# 验证：艾佳宁 (mn-20049) 在 武夷山？
for a in col['activities']:
    if a['activityKey'] == 'yolo-2026-wuyishan':
        has_jj = any(p['userId'] == 'mn-20049' for p in a['participants'])
        print(f'\n武夷山 总参与: {len(a["participants"])} 人')
        print(f'  艾佳宁 (mn-20049) in 武夷山: {has_jj}')
        break
