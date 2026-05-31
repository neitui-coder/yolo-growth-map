#!/usr/bin/env python3
"""Generate content gap reports for YOLO+ members and activities."""

import csv
import json
import os
from datetime import datetime, timezone


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEMBERS_PATH = os.path.join(REPO, "data", "yolo-2025-members.master.json")
ACTIVITIES_PATH = os.path.join(REPO, "data", "yolo-activities-collection.json")
PERSONAL_EVENTS_PATH = os.path.join(REPO, "data", "yolo-personal-events.json")
OUTPUT_DIR = os.path.join(REPO, "outputs")


def value_at(obj, path):
    cur = obj
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def is_blank(value):
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() in {"", "/", "-", "无", "暂无", "N/A", "NA"}
    if isinstance(value, (list, tuple, set)):
        return len([item for item in value if not is_blank(item)]) == 0
    return False


def member_gap_row(member, activity_counts):
    profile = member.get("profile", {})
    interests = member.get("interests", {})
    assets = member.get("assets", {})
    gaps = []

    checks = [
        ("头像", assets.get("avatarImage")),
        ("城市", profile.get("city")),
        ("生日", profile.get("birthday")),
        ("学历", profile.get("education")),
        ("职业/公司", profile.get("career") or profile.get("company")),
        ("MBTI", profile.get("mbti")),
        ("盖洛普", profile.get("gallup")),
        ("爱好", interests.get("hobbies")),
    ]
    for label, value in checks:
        if is_blank(value):
            gaps.append(label)

    member_line_sources = {"member-2026", "member-edited", "poster-2025", "poster-2025-note"}
    if is_blank(profile.get("motto")) or profile.get("mottoSource") not in member_line_sources:
        gaps.append("本人一句话")

    user_id = member.get("identity", {}).get("userId", "")
    activity_count = activity_counts.get(user_id, 0)
    if activity_count == 0:
        gaps.append("成长节点")

    status = member.get("memberStatus") or ""
    priority = 0
    if status == "active":
        priority += 100
    priority += len(gaps) * 10
    if "头像" in gaps:
        priority += 8
    if "本人一句话" in gaps:
        priority += 5
    if "成长节点" in gaps:
        priority += 5

    return {
        "memberStatus": status,
        "name": member.get("identity", {}).get("name", ""),
        "userId": member.get("identity", {}).get("userId", ""),
        "city": profile.get("city") or "",
        "company": profile.get("company") or "",
        "career": profile.get("career") or "",
        "avatar": "有" if not is_blank(assets.get("avatarImage")) else "缺",
        "activityCount": activity_count,
        "missingCount": len(gaps),
        "missingFields": "、".join(gaps),
        "priority": priority,
    }


def activity_gap_row(activity, member_by_id):
    participants = activity.get("participants") or []
    images = activity.get("images") or []
    gaps = []
    if is_blank(activity.get("coverImage")):
        gaps.append("封面图")
    if is_blank(images):
        gaps.append("活动照片")
    if is_blank(activity.get("summary")):
        gaps.append("活动介绍")
    if is_blank(activity.get("keyHighlights")):
        gaps.append("活动亮点")
    if is_blank(activity.get("location")):
        gaps.append("地点")

    priority = len(gaps) * 10 + min(len(participants), 20)
    if activity.get("date", "") >= "2023":
        priority += 20
    if "活动照片" in gaps:
        priority += 8
    if "活动介绍" in gaps:
        priority += 5

    participant_names = []
    for participant in participants[:8]:
        user_id = participant.get("userId")
        name = member_by_id.get(user_id, {}).get("identity", {}).get("name", user_id)
        participant_names.append(name)

    return {
        "activityKey": activity.get("activityKey", ""),
        "title": activity.get("title", ""),
        "date": activity.get("date", ""),
        "location": activity.get("location", ""),
        "type": activity.get("type", ""),
        "participantCount": len(participants),
        "imageCount": len(images),
        "hasCover": "有" if not is_blank(activity.get("coverImage")) else "缺",
        "hasSummary": "有" if not is_blank(activity.get("summary")) else "缺",
        "hasHighlights": "有" if not is_blank(activity.get("keyHighlights")) else "缺",
        "missingCount": len(gaps),
        "missingFields": "、".join(gaps),
        "sampleParticipants": "、".join(participant_names),
        "priority": priority,
    }


def write_csv(path, rows, fieldnames):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def user_facing_member_gap(row):
    label_map = {
        "职业/公司": "公司或职位",
        "本人一句话": "本人写的一句话",
        "成长节点": "成长记录/活动经历",
    }
    missing = [
        label_map.get(item, item)
        for item in (row.get("missingFields") or "").split("、")
        if item
    ]
    return {
        "会员姓名": row.get("name", ""),
        "已有城市": row.get("city", ""),
        "已有公司": row.get("company", ""),
        "已有职位": row.get("career", ""),
        "已有活动/成长记录数": row.get("activityCount", 0),
        "需要补充": "、".join(missing),
    }


def user_facing_activity_gap(row):
    type_map = {
        "activity": "活动",
        "travel": "游学",
        "annual": "年会",
        "ted": "TED分享",
        "join": "加入YOLO+",
        "role": "角色",
        "life": "生活节点",
        "cert": "认证",
    }
    return {
        "活动": row.get("title", ""),
        "时间": row.get("date", ""),
        "地点": row.get("location", ""),
        "类型": type_map.get(row.get("type", ""), row.get("type", "")),
        "已记录参与人数": row.get("participantCount", 0),
        "已有照片数": row.get("imageCount", 0),
        "需要补充": row.get("missingFields", ""),
        "参与者示例": row.get("sampleParticipants", ""),
    }


def md_table(rows, columns, limit):
    selected = rows[:limit]
    if not selected:
        return "无\n"
    lines = [
        "| " + " | ".join(label for _, label in columns) + " |",
        "| " + " | ".join("---" for _ in columns) + " |",
    ]
    for row in selected:
        values = []
        for key, _ in columns:
            text = str(row.get(key, "")).replace("\n", " ").replace("|", "/")
            values.append(text)
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines) + "\n"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(MEMBERS_PATH, encoding="utf-8") as f:
        members_data = json.load(f)
    with open(ACTIVITIES_PATH, encoding="utf-8") as f:
        activities_data = json.load(f)
    if os.path.exists(PERSONAL_EVENTS_PATH):
        with open(PERSONAL_EVENTS_PATH, encoding="utf-8") as f:
            personal_events_data = json.load(f)
    else:
        personal_events_data = {"eventsByUserId": {}}

    members = members_data.get("members", [])
    activities = activities_data.get("activities", [])
    member_by_id = {
        member.get("identity", {}).get("userId"): member
        for member in members
    }
    activity_counts = {}
    for activity in activities:
        for participant in activity.get("participants") or []:
            user_id = participant.get("userId")
            if user_id:
                activity_counts[user_id] = activity_counts.get(user_id, 0) + 1
    for user_id, events in (personal_events_data.get("eventsByUserId") or {}).items():
        activity_counts[user_id] = activity_counts.get(user_id, 0) + len(events or [])

    member_rows = [member_gap_row(member, activity_counts) for member in members]
    member_rows.sort(key=lambda row: (-row["priority"], row["memberStatus"], row["name"]))
    activity_rows = [activity_gap_row(activity, member_by_id) for activity in activities]
    activity_rows.sort(key=lambda row: (-row["priority"], row["date"], row["title"]))

    active_rows = [row for row in member_rows if row["memberStatus"] == "active"]
    alumni_rows = [row for row in member_rows if row["memberStatus"] == "alumni"]
    active_gap_rows = [row for row in active_rows if row["missingCount"] > 0]
    alumni_gap_rows = [row for row in alumni_rows if row["missingCount"] > 0]

    member_csv = os.path.join(OUTPUT_DIR, "member-missing-info.csv")
    activity_csv = os.path.join(OUTPUT_DIR, "activity-missing-info.csv")
    user_member_csv = os.path.join(OUTPUT_DIR, "现届会员资料缺口.csv")
    user_activity_csv = os.path.join(OUTPUT_DIR, "活动资料缺口.csv")
    md_path = os.path.join(OUTPUT_DIR, "content-gap-report.md")

    write_csv(member_csv, member_rows, [
        "memberStatus", "name", "userId", "city", "company", "career",
        "avatar", "activityCount", "missingCount", "missingFields", "priority"
    ])
    write_csv(activity_csv, activity_rows, [
        "activityKey", "title", "date", "location", "type", "participantCount",
        "imageCount", "hasCover", "hasSummary", "hasHighlights",
        "missingCount", "missingFields", "sampleParticipants", "priority"
    ])
    write_csv(
        user_member_csv,
        [user_facing_member_gap(row) for row in active_gap_rows],
        ["会员姓名", "已有城市", "已有公司", "已有职位", "已有活动/成长记录数", "需要补充"],
    )
    write_csv(
        user_activity_csv,
        [user_facing_activity_gap(row) for row in activity_rows if row["missingCount"] > 0],
        ["活动", "时间", "地点", "类型", "已记录参与人数", "已有照片数", "需要补充", "参与者示例"],
    )

    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    activity_missing_images = sum(1 for row in activity_rows if "活动照片" in row["missingFields"])
    activity_missing_summary = sum(1 for row in activity_rows if "活动介绍" in row["missingFields"])
    active_missing_avatar = sum(1 for row in active_rows if "头像" in row["missingFields"])
    active_missing_one_liner = sum(1 for row in active_rows if "本人一句话" in row["missingFields"])

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# YOLO+ 内容补充缺口报告\n\n")
        f.write(f"生成时间：{generated_at}\n\n")
        f.write("## 总览\n\n")
        f.write(f"- 活动：{len(activity_rows)} 个；缺活动照片 {activity_missing_images} 个；缺活动介绍 {activity_missing_summary} 个。\n")
        f.write(f"- 会员：{len(member_rows)} 人；现届 {len(active_rows)} 人，往届 {len(alumni_rows)} 人。\n")
        f.write(f"- 现届会员：有资料缺口 {len(active_gap_rows)} 人；缺头像 {active_missing_avatar} 人；缺本人一句话 {active_missing_one_liner} 人。\n\n")

        f.write("## 优先补活动\n\n")
        f.write(md_table(activity_rows, [
            ("title", "活动"),
            ("date", "时间"),
            ("location", "地点"),
            ("participantCount", "人数"),
            ("imageCount", "照片数"),
            ("missingFields", "缺少内容"),
        ], 20))
        f.write("\n## 优先补现届会员\n\n")
        f.write(md_table(active_gap_rows, [
            ("name", "会员"),
            ("city", "城市"),
            ("company", "公司"),
            ("career", "职位"),
            ("activityCount", "节点数"),
            ("missingFields", "缺少内容"),
        ], 32))
        f.write("\n## 往届会员缺口较多者\n\n")
        f.write(md_table(alumni_gap_rows, [
            ("name", "会员"),
            ("city", "城市"),
            ("activityCount", "节点数"),
            ("missingFields", "缺少内容"),
        ], 30))
        f.write("\n## CSV 明细\n\n")
        f.write(f"- 会员明细：`{member_csv}`\n")
        f.write(f"- 活动明细：`{activity_csv}`\n")
        f.write(f"- 现届会员中文缺口：`{user_member_csv}`\n")
        f.write(f"- 活动中文缺口：`{user_activity_csv}`\n")

    print(json.dumps({
        "members": len(member_rows),
        "activeMembers": len(active_rows),
        "activities": len(activity_rows),
        "memberCsv": member_csv,
        "activityCsv": activity_csv,
        "userMemberCsv": user_member_csv,
        "userActivityCsv": user_activity_csv,
        "markdown": md_path,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
