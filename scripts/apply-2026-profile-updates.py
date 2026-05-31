#!/usr/bin/env python3
"""Apply 2026 profile collection workbook updates to master data.

The workbook is a human collection sheet, so this script treats blank cells as
"no change" and records every applied update for review.
"""

import datetime as dt
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_PATH = os.path.expanduser("~/Downloads/YOLO+2026年会员成长档案资料收集.xlsx")
MASTER_PATH = os.path.join(REPO, "data", "yolo-2025-members.master.json")
REPORT_PATH = os.path.join(REPO, "outputs", "2026-profile-update-report.json")

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
NS_PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"

NAME_ALIASES = {
    "陈威全Bill": "陈威全",
    "沈吟": "沈吟",
    "沈  吟": "沈吟",
}

NEW_MEMBER_IDS = {
    "李文越": "new2026-liwenyue",
    "马思勉": "new2026-masimian",
    "潘宇昊": "new2026-panyuhao",
    "龚浩然": "new2026-gonghaoran",
    "於德悦": "new2026-yudeyue",
}

CURRENT_2026_CATEGORIES = {"创始理事", "现届会员", "新增会员"}

MBTI_RE = re.compile(r"\b(INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)\b", re.I)
GALLUP_WORDS = {
    "战略", "分析", "个别", "自信", "统筹", "学习", "思维", "理念", "排难",
    "交往", "适应", "伯乐", "积极", "体谅", "沟通", "行动", "取悦", "完美",
    "追求", "责任", "成就", "专注", "前瞻", "和谐", "公平", "审慎", "关联",
}


def col_to_idx(col):
    n = 0
    for char in col:
        n = n * 26 + ord(char) - 64
    return n - 1


def clean_text(value):
    if value is None:
        return ""
    text = str(value).replace("\u3000", " ").strip()
    text = re.sub(r"[ \t]+", " ", text)
    return text


def compact_text(value):
    return re.sub(r"\s+", " ", clean_text(value)).strip()


def excel_date(value):
    text = clean_text(value)
    if not re.fullmatch(r"\d+(\.0+)?", text):
        return text
    date = dt.datetime(1899, 12, 30) + dt.timedelta(days=float(text))
    return f"{date.month}月{date.day}日"


def read_xlsx_rows(path):
    with zipfile.ZipFile(path) as zf:
        shared = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            shared = [
                "".join((t.text or "") for t in item.iter(NS + "t"))
                for item in root.findall(NS + "si")
            ]
        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rid_to_target = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall(NS_PKG + "Relationship")
        }
        sheet = workbook.find(NS + "sheets").findall(NS + "sheet")[0]
        target = rid_to_target[sheet.attrib[NS_REL + "id"]]
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        root = ET.fromstring(zf.read(target))

        rows = {}
        for row in root.iter(NS + "row"):
            row_index = int(row.attrib.get("r", "0"))
            values = {}
            for cell in row.iter(NS + "c"):
                ref = cell.attrib.get("r", "")
                match = re.match(r"([A-Z]+)", ref)
                if not match:
                    continue
                col = col_to_idx(match.group(1))
                cell_type = cell.attrib.get("t", "n")
                value_node = cell.find(NS + "v")
                inline_node = cell.find(NS + "is")
                value = ""
                if value_node is not None and value_node.text is not None:
                    value = shared[int(value_node.text)] if cell_type == "s" else value_node.text
                elif inline_node is not None:
                    value = "".join((t.text or "") for t in inline_node.iter(NS + "t"))
                value = clean_text(value)
                if value:
                    values[col] = value
            if values:
                rows[row_index] = values
        return rows


def normalize_name(value):
    text = re.sub(r"\s+", "", clean_text(value))
    return NAME_ALIASES.get(text, text)


def normalize_city(value):
    text = compact_text(value)
    if not text or text in {"/", "-", "无", "暂无", "N/A", "NA"}:
        return ""
    text = text.replace("，", ",").replace("、", ",").replace("－", "-").replace("—", "-").replace("–", "-")
    text = re.sub(r"\s+", "", text)
    if "," in text:
        text = text.split(",")[-1]
    if "-" in text:
        parts = [p for p in text.split("-") if p]
        if parts:
            if parts[0] in {"上海", "北京", "天津", "重庆"}:
                text = parts[0]
            else:
                text = parts[-1]
    for prefix in ["中国大陆", "中国", "美国", "英国", "加拿大", "澳大利亚", "日本", "韩国", "法国", "德国", "新加坡"]:
        if text.startswith(prefix) and len(text) > len(prefix):
            text = text[len(prefix):]
    for prefix in ["浙江", "江苏", "广东", "福建", "山东", "河南", "河北", "湖南", "湖北", "四川", "陕西", "山西", "安徽", "江西", "广西", "云南", "贵州", "辽宁"]:
        if text.startswith(prefix) and len(text) > len(prefix):
            text = text[len(prefix):]
    return text


def split_list(value):
    text = clean_text(value)
    if not text:
        return []
    text = re.sub(r"（[^）]*）", lambda m: m.group(0).replace("、", "，"), text)
    parts = re.split(r"[、,，;；\n]+", text)
    return [compact_text(p) for p in parts if compact_text(p)]


def normalize_hobby(value):
    text = compact_text(value)
    direct = {
        "看書": "看书",
        "看书": "看书",
        "单机游戏": "游戏",
        "FPS 类游戏": "FPS游戏",
        "FPS类游戏": "FPS游戏",
        "科幻类电影": "科幻电影",
        "滑雪（单板）": "单板滑雪",
        "看电影": "电影",
        "打网球": "网球",
        "打高尔夫": "高尔夫",
        "德州扑克 电影": "德州扑克、电影",
        "硬核露营": "露营",
        "马术（感兴趣）": "马术",
    }
    return direct.get(text, text)


def normalize_hobbies(values):
    seen = set()
    result = []
    for raw in values:
        for item in split_list(raw):
            hobby = normalize_hobby(item)
            if not hobby or hobby in seen:
                continue
            if hobby == "德州扑克、电影":
                for sub in ["德州扑克", "电影"]:
                    if sub not in seen:
                        seen.add(sub)
                        result.append(sub)
                continue
            seen.add(hobby)
            result.append(hobby)
    return result


def extract_mbti(*values):
    text = "\n".join(clean_text(v) for v in values if v)
    match = MBTI_RE.search(text)
    return match.group(1).upper() if match else ""


def extract_gallup(*values):
    text = "\n".join(clean_text(v) for v in values if v)
    found = []
    for token in re.split(r"[/、,，\s\n]+", text):
        token = compact_text(token).strip("~：:；;。")
        if token in GALLUP_WORDS and token not in found:
            found.append(token)
    return found[:5]


def looks_education(value):
    text = clean_text(value)
    return bool(re.search(r"大学|学院|专业|本科|研究生|硕士|博士|MBA|商学院", text))


def should_skip_value(value):
    return compact_text(value) in {"", "/", "-", "无", "暂无", "N/A", "NA"}


def set_path(member, path, value, changes, source_row):
    target = member
    for key in path[:-1]:
        if key not in target or target[key] is None:
            target[key] = {}
        target = target[key]
    key = path[-1]
    old = target.get(key)
    if old == value:
        return
    target[key] = value
    changes.append({
        "row": source_row,
        "userId": member["identity"]["userId"],
        "name": member["identity"]["name"],
        "field": ".".join(path),
        "old": old,
        "new": value,
    })


def make_new_member(name):
    user_id = NEW_MEMBER_IDS[name]
    return {
        "memberStatus": "active",
        "identity": {"userId": user_id, "name": name, "englishName": ""},
        "community": {
            "role": "会员",
            "isLishi": False,
            "memberNo": "",
            "category": "",
            "joinYear": 2026,
            "durationYears": 1,
            "joinDate": "2026-01",
            "joinPeriods": [{"start": "2026-01", "end": None}],
            "phones": [],
        },
        "profile": {
            "mbti": "",
            "gallup": [],
            "company": "",
            "career": "",
            "city": "",
            "birthday": "",
            "education": "",
            "educationDegree": "",
            "motto": "",
        },
        "interests": {"hobbies": []},
        "assets": {},
        "import": {"dataType": "real", "source": "yolo-2026-profile-collection"},
    }


def apply_row(member, row, source_row, changes):
    name = member.get("identity", {}).get("name", "")
    profile = member.setdefault("profile", {})
    interests = member.setdefault("interests", {})

    # Birthday: column G is the official birthday column; column F is used as a fallback in this workbook.
    birthday_raw = row.get(6) or row.get(5)
    birthday = excel_date(birthday_raw) if birthday_raw else ""
    if birthday and not should_skip_value(birthday):
        set_path(member, ["profile", "birthday"], birthday, changes, source_row)

    work = compact_text(row.get(8, ""))
    career = compact_text(row.get(9, ""))
    if name == "李维韵":
        work = work.replace("公众号", "").strip()
    if name == "李文越":
        if work == "上海欣驰电子有限公司企业":
            work = "上海欣驰电子有限公司"
        if career == "发展部总监":
            career = "企业发展部总监"

    education = compact_text(row.get(7, "")).replace(" / ", " / ")
    if education and not should_skip_value(education):
        education = re.sub(r"\s*\n\s*", " / ", education)
        if name == "林海" and work and looks_education(work) and should_skip_value(career) and work not in education:
            education = f"{education} / {work}"
        set_path(member, ["profile", "education"], education, changes, source_row)

    if work and not should_skip_value(work):
        if name == "林海" and looks_education(work) and should_skip_value(career):
            set_path(member, ["profile", "company"], "", changes, source_row)
        else:
            set_path(member, ["profile", "company"], work, changes, source_row)
    if career and not should_skip_value(career):
        set_path(member, ["profile", "career"], career, changes, source_row)

    city = normalize_city(row.get(10, ""))
    notes = "\n".join(clean_text(row.get(i, "")) for i in (11, 16) if row.get(i))
    if "地点：更改成美国" in notes:
        city = "美国"
    if city and not should_skip_value(city):
        set_path(member, ["profile", "city"], city, changes, source_row)

    motto = compact_text(row.get(14, ""))
    if motto and not should_skip_value(motto):
        motto = re.sub(r"^(slogan|Slogan|SLOGAN)\s*[：:]\s*", "", motto)
        set_path(member, ["profile", "motto"], motto, changes, source_row)
        set_path(member, ["profile", "mottoSource"], "member-2026", changes, source_row)

    mbti = extract_mbti(row.get(11), row.get(16))
    if mbti:
        set_path(member, ["profile", "mbti"], mbti, changes, source_row)

    gallup = extract_gallup(row.get(11), row.get(16))
    if gallup:
        set_path(member, ["profile", "gallup"], gallup, changes, source_row)

    english_match = re.search(r"英文名[：:]\s*([A-Za-z][A-Za-z .'-]*)", notes)
    if english_match:
        set_path(member, ["identity", "englishName"], compact_text(english_match.group(1)), changes, source_row)

    hobby_cell = clean_text(row.get(13, ""))
    old_hobbies = interests.get("hobbies") or []
    if hobby_cell:
        if hobby_cell.startswith("删除"):
            remove_tokens = []
            for quoted in re.findall(r"[“\"]([^”\"]+)[”\"]", hobby_cell):
                remove_tokens.extend(normalize_hobbies([quoted]))
            next_hobbies = [
                h for h in old_hobbies
                if normalize_hobby(h) not in remove_tokens and h not in remove_tokens
            ]
            if next_hobbies != old_hobbies:
                set_path(member, ["interests", "hobbies"], next_hobbies, changes, source_row)
        else:
            next_hobbies = normalize_hobbies([hobby_cell])
            if next_hobbies:
                set_path(member, ["interests", "hobbies"], next_hobbies, changes, source_row)

    if "興趣：（加上）看書" in notes or "兴趣：（加上）看书" in notes:
        next_hobbies = normalize_hobbies(old_hobbies + ["看书"])
        set_path(member, ["interests", "hobbies"], next_hobbies, changes, source_row)

    if "冒险活动增加：马术" in notes:
        next_hobbies = normalize_hobbies((interests.get("hobbies") or []) + ["马术"])
        set_path(member, ["interests", "hobbies"], next_hobbies, changes, source_row)
    if "硬核露营删除" in notes:
        next_hobbies = [normalize_hobby(h) for h in interests.get("hobbies", [])]
        set_path(member, ["interests", "hobbies"], normalize_hobbies(next_hobbies), changes, source_row)
    if "删除“遛狗”" in notes or "删除遛狗" in notes:
        next_hobbies = [h for h in interests.get("hobbies", []) if normalize_hobby(h) != "遛狗" and h != "遛狗"]
        set_path(member, ["interests", "hobbies"], next_hobbies, changes, source_row)


def apply_confirmed_fixes(members, changes):
    by_name = {
        normalize_name(member.get("identity", {}).get("name", "")): member
        for member in members
    }

    member = by_name.get("吴昌鸿")
    if member:
        set_path(member, ["profile", "motto"], "I came I saw I conquered", changes, "confirmed-fix")

    member = by_name.get("徐志谦")
    if member:
        education = member.get("profile", {}).get("education", "")
        if "经融管理" in education:
            set_path(member, ["profile", "education"], education.replace("经融管理", "金融管理"), changes, "confirmed-fix")

    member = by_name.get("沈吟")
    if member:
        hobbies = member.get("interests", {}).get("hobbies") or []
        next_hobbies = ["关心消费领域" if h == "关心消费邻域" else h for h in hobbies]
        set_path(member, ["interests", "hobbies"], next_hobbies, changes, "confirmed-fix")


def apply_2026_roster_status(members, current_names, changes):
    for member in members:
        if member.get("import", {}).get("dataType") != "real":
            continue
        name = normalize_name(member.get("identity", {}).get("name", ""))
        target_status = "active" if name in current_names else "alumni"
        set_path(member, ["memberStatus"], target_status, changes, "2026-roster")


def main():
    rows = read_xlsx_rows(SOURCE_PATH)
    with open(MASTER_PATH, encoding="utf-8") as f:
        master = json.load(f)

    members = master["members"]
    by_name = {
        normalize_name(member.get("identity", {}).get("name", "")): member
        for member in members
    }

    changes = []
    created = []
    unmatched = []
    current_2026_names = {
        normalize_name(row.get(2, ""))
        for row in rows.values()
        if clean_text(row.get(1, "")) in CURRENT_2026_CATEGORIES and normalize_name(row.get(2, ""))
    }

    for row_index in sorted(k for k in rows if k >= 3):
        row = rows[row_index]
        raw_name = row.get(2, "")
        name = normalize_name(raw_name)
        if not name:
            continue
        member = by_name.get(name)
        if not member and name in NEW_MEMBER_IDS:
            member = make_new_member(name)
            members.append(member)
            by_name[name] = member
            created.append({"row": row_index, "name": name, "userId": member["identity"]["userId"]})
        if not member:
            unmatched.append({"row": row_index, "name": raw_name})
            continue

        if row.get(1) == "新增会员" or name == "林乐怡":
            if member.get("memberStatus") != "active":
                set_path(member, ["memberStatus"], "active", changes, row_index)
            community = member.setdefault("community", {})
            if not community.get("joinYear"):
                set_path(member, ["community", "joinYear"], 2026, changes, row_index)
                set_path(member, ["community", "durationYears"], 1, changes, row_index)
                set_path(member, ["community", "joinDate"], "2026-01", changes, row_index)
                set_path(member, ["community", "joinPeriods"], [{"start": "2026-01", "end": None}], changes, row_index)
            if not community.get("role"):
                set_path(member, ["community", "role"], "会员", changes, row_index)

        apply_row(member, row, row_index, changes)

    apply_confirmed_fixes(members, changes)
    apply_2026_roster_status(members, current_2026_names, changes)

    display_fields = master.get("rules", {}).get("displayFields")
    if isinstance(display_fields, list) and "birthdayMonth" in display_fields:
        display_fields.remove("birthdayMonth")

    master["generatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    with open(MASTER_PATH, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=2)
        f.write("\n")

    report = {
        "source": SOURCE_PATH,
        "generatedAt": master["generatedAt"],
        "created": created,
        "unmatched": unmatched,
        "changes": changes,
        "counts": {
            "members": len(members),
            "active": sum(1 for m in members if m.get("memberStatus") == "active"),
            "alumni": sum(1 for m in members if m.get("memberStatus") == "alumni"),
            "created": len(created),
            "changedFields": len(changes),
        },
    }
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(json.dumps(report["counts"], ensure_ascii=False, indent=2))
    if unmatched:
        print("unmatched:", json.dumps(unmatched, ensure_ascii=False))


if __name__ == "__main__":
    main()
