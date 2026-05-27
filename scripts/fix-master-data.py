#!/usr/bin/env python3
"""一次性修复 master：
- 徐志谦 isLishi=True（用户确认是理事）
- 杭一璐 city = "英国"（之前是 "英国-" 有多余横线）
- 13 个缺头像的会员，按 PDF_SLUG → cloud avatars URL 回填
"""
import json
import re

REPO = '/Users/Sean/WeChatProjects/miniprogram-2'
MASTER = f'{REPO}/data/yolo-2025-members.master.json'

# name → 老 PDF slug（用来构造 cloud avatar 路径）
PDF_SLUG = {
    '陈威全': 'bill', '高海纯': 'katherine', '张瑞琪': 'rachel', '周玥': 'yueyue',
    '蒋柳璟子': 'jingzi', '罗琦玥': 'sarah', '王骁': 'sean', '徐志谦': 'zhiqian',
    '邓礼睿': 'p09', '吴梓萌': 'monica', '吴昌鸿': 'peter', '张嘉沁': 'amber',
    '胡润卿': 'charles', '艾佳宁': 'janine', '林安之': 'rita', '高直方': 'kevin',
    '潘佳瑜': 'jiayu', '范晓雁': 'xiaoyan', '詹卓凡': 'zhuofan', '林海': 'jerry',
    '苏炜烔': 'mat-so', '林佳炜': 'jiawei', '宣文馨': 'wenxin', '沈吟': 'shenyin',
    '解圓尉': 'nara', '杭一璐': 'lucy', '葛汉': 'jackson', '彭唐心': 'chloe',
    '李博源': 'boyuan', '高秋闲': 'sarah-p30', '李维韵': 'weiyun', '苏雨': 'sophie',
    '高嘉瞳': 'jiatong', '毕伟杰': 'weijie', '陆怡霖': 'linda', '陈其乐': 'dufresne',
    '宗羱': 'eco', '王睿翔': 'ruixiang',
}
AVATAR_BASE = 'cloud://cloud1-7giblg7i4595eaf3.636c-cloud1-7giblg7i4595eaf3-1306756329/yolo-growth-map/media/avatars/pdf2025-'

with open(MASTER, encoding='utf-8') as f:
    m = json.load(f)

fixes = []
avatars_added = 0
for x in m['members']:
    name = x['identity']['name']
    # 1. 徐志谦 = 理事
    if name == '徐志谦':
        if not x['community'].get('isLishi'):
            x['community']['isLishi'] = True
            # 标准 role 显示为"理事"
            x['community']['role'] = '理事'
            fixes.append('徐志谦 → isLishi=True, role="理事"')
    # 2. 杭一璐 city 修正
    if name == '杭一璐':
        if x['profile'].get('city', '').endswith('-'):
            old = x['profile']['city']
            x['profile']['city'] = re.sub(r'[-—]+$', '', old).strip()
            fixes.append(f'杭一璐 city "{old}" → "{x["profile"]["city"]}"')
    # 3. 头像回填
    if not x.get('assets', {}).get('avatarImage'):
        slug = PDF_SLUG.get(name)
        if slug:
            x.setdefault('assets', {})['avatarImage'] = AVATAR_BASE + slug + '.jpg'
            avatars_added += 1
            fixes.append(f'{name} avatarImage = pdf2025-{slug}.jpg')

with open(MASTER, 'w', encoding='utf-8') as f:
    json.dump(m, f, ensure_ascii=False, indent=2)

for f in fixes:
    print(' ', f)
print(f'\n共修复：{len(fixes)} 项（其中 {avatars_added} 个头像回填）')
