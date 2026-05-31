#!/usr/bin/env python3
"""Rebuild public activity attendance from Sean's combined workbook.

Rules:
  - Public group activities record only who attended; role/position is not stored.
  - One-on-one, Coach, and Gallup private records are never imported.
  - TED Talk labels in activity role cells become personal timeline events only.
"""

import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone


NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
NS_PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"

DL = os.path.expanduser("~/Downloads")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SOURCE = os.path.join(DL, "YOLO+出席表 (2).xlsx")
ACTIVITIES_PATH = os.path.join(REPO, "data", "yolo-activities-collection.json")
MASTER_PATH = os.path.join(REPO, "data", "yolo-2025-members.master.json")
PERSONAL_EVENTS_PATH = os.path.join(REPO, "data", "yolo-personal-events.json")


ALIASES = {
    "Angela": "黄蕾",
    "angela": "黄蕾",
    "Howard": "周浩铖",
    "howard": "周浩铖",
    "周浩成": "周浩铖",
    "Tony": "王泽鹏",
    "tony": "王泽鹏",
    "Chloe": "彭唐心",
    "chloe": "彭唐心",
    "Chole": "彭唐心",
    "chole": "彭唐心",
    "Bill": "陈威全",
    "BiLL": "陈威全",
    "bill": "陈威全",
    "彭雨": "彭唐心",
    "彭雨(彭唐心)": "彭唐心",
    "彭雨（彭唐心）": "彭唐心",
    "解凰尉": "解圓尉",
    "博媛": "张博媛",
    "唐凯飞": "唐恺飞",
    "纪昱呈": "纪域呈",
}

PRIVATE_ACTIVITY_KEYS = {
    "yolo-2023-mentor-1on1",
    "yolo-2023-coach",
    "yolo-2023-elsa-coach",
    "yolo-2023-gallup-1on1",
}


def col_to_idx(col):
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - ord("A") + 1)
    return n - 1


def normalize_name(value):
    text = re.sub(r"[\s　]+", "", str(value or "")).strip()
    return ALIASES.get(text, text)


def is_attended(value):
    text = str(value or "").strip()
    if not text:
        return False
    try:
        return float(text) > 0
    except ValueError:
        return False


def read_shared_strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return [
        "".join((text.text or "") for text in item.iter(NS + "t"))
        for item in root.findall(NS + "si")
    ]


def workbook_sheet_targets(zf):
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rid_to_target = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(NS_PKG + "Relationship")
    }

    targets = []
    for sheet in workbook.find(NS + "sheets").findall(NS + "sheet"):
        target = rid_to_target[sheet.attrib[NS_REL + "id"]]
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        targets.append((sheet.attrib["name"], target))
    return targets


def parse_xlsx(path):
    with zipfile.ZipFile(path) as zf:
        shared = read_shared_strings(zf)
        sheets = {}
        for name, target in workbook_sheet_targets(zf):
            root = ET.fromstring(zf.read(target))
            rows = {}
            for row in root.iter(NS + "row"):
                row_idx = int(row.get("r")) - 1
                rows[row_idx] = {}
                for cell in row.iter(NS + "c"):
                    ref = cell.get("r")
                    if not ref:
                        continue
                    col_idx = col_to_idx(re.match(r"^([A-Z]+)", ref).group(1))
                    cell_type = cell.get("t", "n")
                    value_node = cell.find(NS + "v")
                    inline_node = cell.find(NS + "is")
                    value = ""
                    if value_node is not None and value_node.text is not None:
                        value = shared[int(value_node.text)] if cell_type == "s" else value_node.text
                    elif inline_node is not None:
                        value = "".join((text.text or "") for text in inline_node.iter(NS + "t"))
                    rows[row_idx][col_idx] = value
            sheets[name] = rows
    return sheets


def load_member_resolver():
    with open(MASTER_PATH, encoding="utf-8") as f:
        master = json.load(f)

    name_to_uid = {}
    uid_to_name = {}
    for member in master["members"]:
        uid = member["identity"]["userId"]
        name = member["identity"]["name"]
        name_to_uid[normalize_name(name)] = uid
        uid_to_name[uid] = name
        english_name = (member["identity"].get("englishName") or "").strip()
        if english_name:
            name_to_uid[normalize_name(english_name)] = uid

    def resolve(raw_name):
        return name_to_uid.get(normalize_name(raw_name))

    return resolve, uid_to_name


ACTIVITY_CONFIGS = [
    # 2018
    {"sheet": "2018年出席表", "rowStart": 3, "col": 2, "key": "yolo-2018-hongkong-06", "title": "YOLO+ 6月香港活动", "date": "2018-06", "location": "香港", "type": "travel"},
    {"sheet": "2018年出席表", "rowStart": 3, "col": 3, "key": "yolo-2018-usa-08", "title": "YOLO+ 8月美国活动", "date": "2018-08", "location": "美国", "type": "travel"},
    {"sheet": "2018年出席表", "rowStart": 3, "col": 4, "key": "yolo-2018-shanghai-1w-12", "title": "YOLO+ 12月上海1W", "date": "2018-12", "location": "上海", "type": "annual"},
    {"sheet": "2018年出席表", "rowStart": 3, "col": 5, "key": "yolo-2018-shanghai-1s-12", "title": "YOLO+ 12月上海 1S", "date": "2018-12", "location": "上海", "type": "activity"},
    # 2019
    {"sheet": "2019年出席表", "rowStart": 2, "col": 2, "key": "yolo-2019-taiwan-06", "title": "YOLO+ 6月台湾活动", "date": "2019-06", "location": "台湾", "type": "travel"},
    {"sheet": "2019年出席表", "rowStart": 2, "col": 3, "key": "yolo-2019-france-08", "title": "YOLO+ 8月法国活动", "date": "2019-08", "location": "法国", "type": "travel"},
    {"sheet": "2019年出席表", "rowStart": 2, "col": 4, "key": "yolo-2019-shenzhen-11", "title": "YOLO+ 11月深圳年会活动 1W", "date": "2019-11", "location": "深圳", "type": "annual"},
    {"sheet": "2019年出席表", "rowStart": 2, "col": 5, "key": "yolo-2019-hangzhou-12", "title": "YOLO+ 12月杭州活动  1S", "date": "2019-12", "location": "杭州", "type": "activity"},
    # 2020
    {"sheet": "2020年出席表", "rowStart": 2, "col": 2, "key": "yolo-2020-shenzhen-08", "title": "YOLO+ 8月深圳活动", "date": "2020-08", "location": "深圳", "type": "activity"},
    {"sheet": "2020年出席表", "rowStart": 2, "col": 3, "key": "yolo-2020-beijing-09", "title": "YOLO+ 9月北京活动", "date": "2020-09", "location": "北京", "type": "activity"},
    {"sheet": "2020年出席表", "rowStart": 2, "col": 4, "key": "yolo-2020-hangzhou-11", "title": "YOLO+ 11月杭州活动", "date": "2020-11", "location": "杭州", "type": "activity"},
    # 2021
    {"sheet": "2021年出席表", "rowStart": 2, "col": 2, "key": "yolo-2021-beijing-07", "title": "YOLO+ 7月北京活动", "date": "2021-07", "location": "北京", "type": "activity"},
    {"sheet": "2021年出席表", "rowStart": 2, "col": 3, "key": "yolo-2021-online-09", "title": "YOLO+ 9月22日樊华良线上活动", "date": "2021-09", "dateRange": "9月22日", "location": "线上", "type": "activity"},
    {"sheet": "2021年出席表", "rowStart": 2, "col": 4, "key": "yolo-2021-shanghai-10", "title": "YOLO+ 10月上海导师小组活动", "date": "2021-10", "location": "上海", "type": "activity"},
    {"sheet": "2021年出席表", "rowStart": 2, "col": 5, "key": "yolo-2021-gba-11", "title": "YOLO+ 11月大湾区年会活动", "date": "2021-11", "location": "大湾区", "type": "annual"},
    {"sheet": "2021年出席表", "rowStart": 2, "col": 6, "key": "yolo-2021-online-12", "title": "YOLO+ 12月孙辉导师线上活动", "date": "2021-12", "location": "线上", "type": "activity"},
    {"sheet": "2021年出席表", "rowStart": 2, "col": 7, "key": "yolo-2021-online-02", "title": "YOLO+ 2月袁纯导师线上活动", "date": "2021-02", "location": "线上", "type": "activity"},
    # 2022
    {"sheet": "2022年出席表", "rowStart": 2, "col": 2, "key": "yolo-2022-chengdu-07", "title": "YOLO+ 7月8-9日成都活动", "date": "2022-07", "dateRange": "7月8-9日", "location": "成都", "type": "activity"},
    {"sheet": "2022年出席表", "rowStart": 2, "col": 3, "key": "yolo-2022-changsha-08", "title": "YOLO+ 8月19-21日长沙活动", "date": "2022-08", "dateRange": "8月19-21日", "location": "长沙", "type": "activity"},
    {"sheet": "2022年出席表", "rowStart": 2, "col": 4, "key": "yolo-2022-hangzhou-09", "title": "YOLO+ 9月2-3日杭州活动", "date": "2022-09", "dateRange": "9月2-3日", "location": "杭州", "type": "activity"},
    {"sheet": "2022年出席表", "rowStart": 2, "col": 5, "key": "yolo-2022-shanghai-11", "title": "YOLO+ 11月18-20日上海年会", "date": "2022-11", "dateRange": "11月18-20日", "location": "上海", "type": "annual"},
    # 2023
    {"sheet": "2023年出席表", "rowStart": 4, "col": 3, "key": "yolo-2023-hongkong", "title": "YOLO+ 香港游学", "date": "2023-07", "location": "香港", "type": "travel"},
    {"sheet": "2023年出席表", "rowStart": 4, "col": 4, "key": "yolo-2023-japan", "title": "YOLO+ 日本游学", "date": "2023-09", "location": "日本", "type": "travel"},
    {"sheet": "2023年出席表", "rowStart": 4, "col": 5, "key": "yolo-2023-chongqing", "title": "YOLO+ 重庆年会", "date": "2023-11", "location": "重庆", "type": "annual"},
    {"sheet": "2023年出席表", "rowStart": 4, "col": 6, "key": "yolo-2024-shanghai-march", "title": "YOLO+ 上海区域活动（3月）", "date": "2024-03", "location": "上海", "type": "activity"},
    {"sheet": "2023年出席表", "rowStart": 4, "col": 8, "key": "yolo-2023-mentor-group", "title": "YOLO+ 导师小组", "date": "2023-06", "dateRange": "会员年度", "location": "", "type": "activity"},
    # 2024
    {"sheet": "2024年出席表", "rowStart": 4, "col": 3, "roleCol": 4, "key": "yolo-2024-shenzhen", "title": "YOLO+ 深圳游学", "date": "2024-07", "location": "深圳", "type": "travel"},
    {"sheet": "2024年出席表", "rowStart": 4, "col": 5, "roleCol": 6, "key": "yolo-2024-singapore", "title": "YOLO+ 新加坡游学", "date": "2024-09", "location": "新加坡", "type": "travel"},
    {"sheet": "2024年出席表", "rowStart": 4, "col": 7, "roleCol": 8, "key": "yolo-2024-macau", "title": "YOLO+ 澳门年会", "date": "2024-11", "location": "澳门", "type": "annual"},
    {"sheet": "2024年出席表", "rowStart": 4, "col": 9, "roleCol": 10, "key": "yolo-2025-wenling", "title": "YOLO+ 温岭区域活动", "date": "2025-03", "dateRange": "3月13日—15日", "location": "温岭", "type": "activity"},
    # 2025
    {"sheet": "2025年出席表", "rowStart": 4, "col": 3, "roleCol": 4, "key": "yolo-2025-yantai", "title": "YOLO+ 烟台使命探索之旅", "date": "2025-06", "dateRange": "6月26日—28日", "location": "烟台", "type": "activity"},
    {"sheet": "2025年出席表", "rowStart": 4, "col": 5, "roleCol": 6, "key": "yolo-2025-zhengzhou", "title": "YOLO+ 郑州变革管理模块", "date": "2025-08", "dateRange": "8月7日—9日", "location": "郑州", "type": "activity"},
    {"sheet": "2025年出席表", "rowStart": 4, "col": 7, "roleCol": 8, "key": "yolo-2025-middleeast", "title": "YOLO+ 中东海外游学", "date": "2025-09", "dateRange": "9月28日—10月3日", "location": "中东", "type": "travel"},
    {"sheet": "2025年出席表", "rowStart": 4, "col": 9, "roleCol": 10, "key": "yolo-2025-suzhou", "title": "YOLO+ 苏州年会", "date": "2025-11", "dateRange": "11月14日—15日", "location": "苏州", "type": "annual"},
    {"sheet": "2025年出席表", "rowStart": 4, "col": 11, "roleCol": 12, "key": "yolo-2026-wuyishan", "title": "YOLO+ 武夷山区域活动", "date": "2026-03", "location": "武夷山", "type": "activity"},
    {"sheet": "2025年出席表", "rowStart": 4, "col": 13, "roleCol": 14, "key": "yolo-2025-shanghai-group", "title": "YOLO+ 上海小组活动", "date": "2025-12", "location": "上海", "type": "activity", "collectiveActivity": False},
    {"sheet": "2025年出席表", "rowStart": 4, "col": 15, "roleCol": 16, "key": "yolo-2025-guangdong-group", "title": "YOLO+ 大湾区小组活动", "date": "2025-12", "location": "广州/深圳", "type": "activity", "collectiveActivity": False},
    {"sheet": "2025年出席表", "rowStart": 4, "col": 17, "roleCol": 18, "key": "yolo-2025-overseas-group", "title": "YOLO+ 海外小组活动", "date": "2025-06", "dateRange": "会员年度", "location": "海外", "type": "activity"},
]


def append_participant(attendance, activity_key, user_id):
    attendance[activity_key][user_id] = ""


def is_data_name(name):
    return bool(name) and normalize_name(name) not in ("合计", "合计数", "类别", "序号", "会员姓名", "姓名", "现有会员", "新增会员")


def build_activity_record(config, participants):
    return {
        "activityKey": config["key"],
        "title": config["title"],
        "date": config["date"],
        "dateRange": config.get("dateRange", ""),
        "location": config.get("location", ""),
        "type": config.get("type", "activity"),
        "collectiveActivity": config.get("collectiveActivity", True),
        "summary": config.get("summary", ""),
        "keyHighlights": [],
        "coverImage": None,
        "images": [],
        "participants": participants,
    }


def parse_public_attendance(sheets, resolve):
    attendance = defaultdict(dict)
    personal_events = defaultdict(dict)
    unmatched = Counter()

    for config in ACTIVITY_CONFIGS:
        rows = sheets.get(config["sheet"])
        if not rows:
            raise RuntimeError(f"missing sheet: {config['sheet']}")
        for row_idx in sorted(rows):
            if row_idx < config["rowStart"]:
                continue
            row = rows[row_idx]
            raw_name = str(row.get(1) or "").strip()
            if not is_data_name(raw_name):
                continue
            if not is_attended(row.get(config["col"])):
                continue

            user_id = resolve(raw_name)
            if not user_id:
                unmatched[raw_name] += 1
                continue

            append_participant(attendance, config["key"], user_id)

            role_text = str(row.get(config.get("roleCol")) or "").strip() if config.get("roleCol") is not None else ""
            if re.search(r"\bTED\b|TED\\s*Talk|ted\\s*talk", role_text, re.I):
                node_id = f"n-ted-{config['key']}-{user_id}"
                personal_events[user_id][node_id] = {
                    "nodeId": node_id,
                    "type": "ted",
                    "date": config["date"],
                    "dateRange": config.get("dateRange", ""),
                    "desc": f"TED Talk：{config['title'].replace('YOLO+ ', '')}",
                    "sourceActivityKey": config["key"],
                    "source": "attendance-role",
                }

    return attendance, personal_events, unmatched


def participant_list(participants_by_uid):
    return [
        {"userId": user_id, "role": ""}
        for user_id in participants_by_uid.keys()
    ]


def main():
    source_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not os.path.exists(source_path):
        raise FileNotFoundError(source_path)

    resolve, uid_to_name = load_member_resolver()
    sheets = parse_xlsx(source_path)
    attendance, personal_events, unmatched = parse_public_attendance(sheets, resolve)

    with open(ACTIVITIES_PATH, encoding="utf-8") as f:
        collection = json.load(f)

    collection["activities"] = [
        activity
        for activity in collection["activities"]
        if activity.get("activityKey") not in PRIVATE_ACTIVITY_KEYS
    ]

    config_by_key = {config["key"]: config for config in ACTIVITY_CONFIGS}
    existing_by_key = {activity["activityKey"]: activity for activity in collection["activities"]}
    changed_keys = []

    for activity_key, participants_by_uid in attendance.items():
        participants = participant_list(participants_by_uid)
        if activity_key in existing_by_key:
            activity = existing_by_key[activity_key]
            before = activity.get("participants") or []
            activity["participants"] = participants
            activity["title"] = activity.get("title") or config_by_key[activity_key]["title"]
            activity["date"] = activity.get("date") or config_by_key[activity_key]["date"]
            activity["dateRange"] = activity.get("dateRange", config_by_key[activity_key].get("dateRange", ""))
            activity["location"] = activity.get("location", config_by_key[activity_key].get("location", ""))
            activity["type"] = activity.get("type") or config_by_key[activity_key].get("type", "activity")
            if before != participants:
                changed_keys.append(activity_key)
        else:
            activity = build_activity_record(config_by_key[activity_key], participants)
            collection["activities"].append(activity)
            existing_by_key[activity_key] = activity
            changed_keys.append(activity_key)

    collection["generatedAt"] = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    collection["activities"].sort(key=lambda a: (a.get("date") or "", a.get("activityKey") or ""))

    event_payload = {
        "schemaVersion": 1,
        "generatedAt": collection["generatedAt"],
        "eventsByUserId": {
            user_id: sorted(events.values(), key=lambda item: (item.get("date") or "", item.get("nodeId") or ""))
            for user_id, events in personal_events.items()
        },
    }

    with open(ACTIVITIES_PATH, "w", encoding="utf-8") as f:
        json.dump(collection, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(PERSONAL_EVENTS_PATH, "w", encoding="utf-8") as f:
        json.dump(event_payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("=== rebuild attendance ===")
    print(f"source: {source_path}")
    print(f"activities: {len(collection['activities'])}")
    print(f"personal TED users: {len(event_payload['eventsByUserId'])}")
    print(f"changed/new activity keys: {len(changed_keys)}")
    for activity_key in changed_keys:
        participants = existing_by_key[activity_key].get("participants") or []
        names = [uid_to_name.get(p["userId"], p["userId"]) for p in participants[:10]]
        suffix = "..." if len(participants) > 10 else ""
        print(f"  {activity_key:<30} {len(participants):>2} 人  {'、'.join(names)}{suffix}")

    if unmatched:
        print("\n未匹配/未同步姓名（不在当前 master 中，或为导师/家属/非会员）：")
        for name, count in unmatched.most_common():
            print(f"  {name}\t{count}")


if __name__ == "__main__":
    main()
