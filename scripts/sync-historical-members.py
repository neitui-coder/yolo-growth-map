#!/usr/bin/env python3
"""Add historical members who appear in public activity attendance.

The Mini Program needs alumni accounts so activity detail pages can show all
participants, but alumni must not be bindable. This script only writes public
profile fields into master data and intentionally drops parent/company-phone
identity fields from the official workbook.
"""

import hashlib
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DL = os.path.expanduser("~/Downloads")
ARCHIVE_PATH = os.path.join(DL, "YOLO+档案信息表（全）.xlsx")
ATTENDANCE_PATH = os.path.join(DL, "YOLO+出席表 (2).xlsx")
MASTER_PATH = os.path.join(REPO, "data", "yolo-2025-members.master.json")
POSTERS_PATH = os.path.join(REPO, "data", "yolo-2025-member-posters.json")
MEDIA_MAP_PATH = os.path.join(REPO, "data", "cloud-media-map.json")

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
NS_PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"


PUBLIC_ATTENDANCE_CONFIG = {
    "2026武夷山小组活动": [(3,)],
    "2025年出席表": [(3,), (5,), (7,), (9,), (11,), (13,), (15,), (17,)],
    "2024年出席表": [(3,), (5,), (7,), (9,)],
    "2023年出席表": [(3,), (4,), (5,), (6,), (8,)],
    "2022年出席表": [(2,), (3,), (4,), (5,)],
    "2021年出席表": [(2,), (3,), (4,), (5,), (6,), (7,)],
    "2020年出席表": [(2,), (3,), (4,)],
    "2019年出席表": [(2,), (3,), (4,), (5,)],
    "2018年出席表": [(2,), (3,), (4,), (5,)],
}

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
    "彭雨\n（彭唐心）": "彭唐心",
    "解凰尉": "解圓尉",
    "博媛": "张博媛",
    "唐凯飞": "唐恺飞",
    "纪昱呈": "纪域呈",
}

MANUAL_IDS = {
    "朱慧溪": "mn-23086",
    "阮赛茜": "mn-21069",
    "金连成": "mn-20053",
    "黄蕾": "mn-23092",
    "陈晓萱": "mn-23093",
    "周浩铖": "mn-23089",
    "朱书妮": "mn-20060",
    "彭唐心": "pdf2025-chloe",
    "李嘉怡": "mn-21077",
    "纪域呈": "mn-18013",
    "胡晋华": "mn-18012",
    "汪汪": "mn-19039",
    "姚语馨": "mn-21070",
    "林乐怡": "hist-linleyi",
    "林青桐": "mn-24096",
    "杜晓欣": "mn-19030",
    "邵怡平": "mn-23087",
    "苏世杰": "mn-19036",
    "欧阳瑾莎": "mn-23083",
    "计嘉伟": "hist-jijiawei",
    "焦桢": "mn-21064",
    "胡晓钰": "mn-23081",
    "邵怡安": "mn-23088",
    "张哲瑞": "mn-19047",
    "孙筠桐": "mn-21066",
}


def col_to_idx(col):
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - ord("A") + 1)
    return n - 1


def parse_xlsx(path):
    with zipfile.ZipFile(path) as zf:
        shared = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            shared = [
                "".join((text.text or "") for text in item.iter(NS + "t"))
                for item in root.findall(NS + "si")
            ]

        targets = []
        if "xl/workbook.xml" in zf.namelist() and "xl/_rels/workbook.xml.rels" in zf.namelist():
            workbook = ET.fromstring(zf.read("xl/workbook.xml"))
            rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
            rid_to_target = {
                rel.attrib["Id"]: rel.attrib["Target"]
                for rel in rels.findall(NS_PKG + "Relationship")
            }
            for sheet in workbook.find(NS + "sheets").findall(NS + "sheet"):
                target = rid_to_target[sheet.attrib[NS_REL + "id"]]
                if not target.startswith("xl/"):
                    target = "xl/" + target.lstrip("/")
                targets.append((sheet.attrib["name"], target))
        else:
            sheet_files = sorted(
                [n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")],
                key=lambda value: int(re.search(r"sheet(\d+)", value).group(1)),
            )
            targets = [(f"sheet{idx + 1}", target) for idx, target in enumerate(sheet_files)]

        sheets = {}
        for sheet_name, target in targets:
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
                    rows[row_idx] = rows.get(row_idx, {})
                    rows[row_idx][col_idx] = value
            sheets[sheet_name] = rows
    return sheets


def normalize_name(value):
    text = re.sub(r"[\s　]+", "", str(value or "")).strip()
    return ALIASES.get(text, text)


def clean_text(value):
    text = str(value or "").replace("\r", "").replace("\n", " ").strip()
    return re.sub(r"\s+", " ", text)


def excel_year(value):
    if value is None or value == "":
        return None
    try:
        return (datetime(1899, 12, 30) + timedelta(days=int(float(value)))).year
    except Exception:
        match = re.search(r"(20\d{2}|19\d{2})", str(value))
        return int(match.group(1)) if match else None


def normalize_city(value):
    text = clean_text(value)
    if not text:
        return ""
    text = re.sub(r"[（(].*?[)）]", "", text)
    text = text.replace("中国大陆", "").replace("中国，", "").replace("中国,", "").replace("中国", "")
    text = text.replace("美国，", "").replace("美国,", "").replace("美国", "")
    parts = re.split(r"[、,，;；/\\-— ]+", text)
    parts = [p.strip() for p in parts if p.strip()]
    return parts[0] if parts else ""


def split_list(value):
    text = clean_text(value)
    if not text or text in ("/", "-", "——", "无"):
        return []
    return [item.strip() for item in re.split(r"[/、,，;；｜|]", text) if item.strip()]


def clean_company(value):
    text = clean_text(value)
    return "" if text in ("/", "-", "——", "无", "暂无", "N/A", "NA") else text


def activity_attendance_names():
    sheets = parse_xlsx(ATTENDANCE_PATH)
    names = set()
    for sheet_name, configs in PUBLIC_ATTENDANCE_CONFIG.items():
        rows = sheets.get(sheet_name, {})
        for row_idx, row in rows.items():
            if row_idx < 2:
                continue
            raw_name = str(row.get(1) or "").strip()
            name = normalize_name(raw_name)
            if not name or name in ("合计", "合计数", "类别", "序号", "会员姓名", "姓名", "现有会员", "新增会员"):
                continue
            for (col_idx,) in configs:
                try:
                    attended = float(str(row.get(col_idx) or "").strip()) > 0
                except ValueError:
                    attended = False
                if attended:
                    names.add(name)
                    break
    return names


def build_poster_index():
    if not os.path.exists(POSTERS_PATH):
        return {}
    raw = json.load(open(POSTERS_PATH, encoding="utf-8"))
    return {normalize_name(item.get("name")): item for item in raw}


def avatar_for_user(user_id):
    if not os.path.exists(MEDIA_MAP_PATH):
        return ""
    media = json.load(open(MEDIA_MAP_PATH, encoding="utf-8"))
    ref = f"/images/avatars/{user_id}.jpg"
    return ((media.get("assets") or {}).get(ref) or {}).get("fileID") or ""


def add_candidate(candidates, name, fields):
    canonical = normalize_name(name)
    if not canonical:
        return
    score = sum(1 for value in fields.values() if value)
    if re.fullmatch(r"\d{4,6}", str(fields.get("memberNo") or "")):
        score += 4
    if str(fields.get("category") or "").lower() in ("w", "s"):
        score += 4
    if fields.get("englishName"):
        score += 2
    old = candidates.get(canonical)
    if not old or score > old["_score"]:
        fields["_score"] = score
        candidates[canonical] = fields


def build_archive_candidates():
    sheets = parse_xlsx(ARCHIVE_PATH)
    candidates = {}
    for rows in sheets.values():
        for row in rows.values():
            # Detailed rows where name is in column B.
            if row.get(1):
                c3 = clean_text(row.get(3))
                c4 = clean_text(row.get(4))
                c5 = clean_text(row.get(5))
                if re.fullmatch(r"\d{4,6}", c3) and c4.lower() in ("w", "s"):
                    join_year = None
                    member_no = c3
                    category = c4
                    role = c5
                    birthday = clean_text(row.get(11))
                else:
                    join_year = excel_year(c3)
                    member_no = c4
                    category = c5
                    role = clean_text(row.get(6))
                    birthday = clean_text(row.get(12) if row.get(12) else row.get(11))
                add_candidate(candidates, row.get(1), {
                    "sourceName": clean_text(row.get(1)),
                    "englishName": clean_text(row.get(2)),
                    "joinYear": join_year,
                    "memberNo": member_no,
                    "category": category,
                    "role": role,
                    "birthday": birthday,
                    "educationDegree": clean_text(row.get(14)),
                    "education": clean_text(row.get(15)),
                    "company": clean_company(row.get(16)),
                    "career": clean_text(row.get(17)),
                    "city": normalize_city(row.get(18)),
                    "hobbies": split_list(row.get(21)),
                    "gallup": split_list(row.get(26)),
                })
            # Roster rows where name is in column C.
            if row.get(2):
                add_candidate(candidates, row.get(2), {
                    "sourceName": clean_text(row.get(2)),
                    "englishName": "",
                    "joinYear": None,
                    "memberNo": "",
                    "category": clean_text(row.get(3)),
                    "role": "会员",
                    "birthday": clean_text(row.get(10)),
                    "educationDegree": clean_text(row.get(13)),
                    "education": clean_text(row.get(14)),
                    "company": clean_company(row.get(15)),
                    "career": clean_text(row.get(16)),
                    "city": normalize_city(row.get(17)),
                    "hobbies": split_list(row.get(20)),
                    "gallup": split_list(row.get(25)),
                })
    return candidates


def user_id_for(name, candidate):
    if name in MANUAL_IDS:
        return MANUAL_IDS[name]
    member_no = clean_text(candidate.get("memberNo"))
    if member_no and re.fullmatch(r"\d{4,6}", member_no):
        return f"mn-{member_no}"
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:10]
    return f"hist-{digest}"


def member_from_sources(name, candidate, poster):
    user_id = user_id_for(name, candidate)
    join_year = candidate.get("joinYear")
    if not join_year:
        member_no = candidate.get("memberNo") or ""
        if re.fullmatch(r"\d{5}", member_no):
            prefix = int(member_no[:2])
            join_year = 2000 + prefix if prefix >= 18 else None
    join_date = f"{join_year}-01" if join_year else "2018-01"

    profile = {
        "mbti": "",
        "gallup": candidate.get("gallup") or [],
        "company": candidate.get("company") or "",
        "city": candidate.get("city") or "",
        "birthday": "",
        "education": candidate.get("education") or "",
        "educationDegree": candidate.get("educationDegree") or "",
        "motto": "",
    }
    interests = { "hobbies": candidate.get("hobbies") or [] }
    english_name = candidate.get("englishName") or ""

    if poster:
        english_name = poster.get("englishName") or english_name
        profile["motto"] = poster.get("motto") or ""
        profile["birthday"] = poster.get("birthday") or ""
        profile["city"] = normalize_city(poster.get("city")) or profile["city"]
        profile["education"] = "；".join(poster.get("education") or []) or profile["education"]
        profile["company"] = poster.get("company") or profile["company"]
        profile["gallup"] = poster.get("gallup") or profile["gallup"]
        interests["hobbies"] = poster.get("hobbies") or interests["hobbies"]

    if not profile["birthday"]:
        month_match = re.match(r"^\d+", str(candidate.get("birthday") or ""))
        if month_match:
            profile["birthday"] = f"{int(month_match.group(0))}月"

    avatar_image = avatar_for_user(user_id)
    return {
        "memberStatus": "alumni",
        "identity": {
            "userId": user_id,
            "name": name,
            "englishName": english_name,
        },
        "community": {
            "role": candidate.get("role") or "会员",
            "isLishi": False,
            "memberNo": candidate.get("memberNo") or "",
            "category": candidate.get("category") or "",
            "joinYear": join_year,
            "durationYears": max(0, datetime.now().year - join_year) if join_year else None,
            "joinDate": join_date,
            "joinPeriods": [{ "start": join_date, "end": None }],
        },
        "profile": profile,
        "interests": interests,
        "assets": { "avatarImage": avatar_image } if avatar_image else {},
        "import": { "dataType": "real", "source": "official-xlsx-historical-attendance" },
    }


def main():
    master = json.load(open(MASTER_PATH, encoding="utf-8"))
    obsolete_names = {"Tony", "纪昱呈"}
    master["members"] = [
        member for member in master["members"]
        if member.get("identity", {}).get("name") not in obsolete_names
    ]
    poster_index = build_poster_index()
    candidates = build_archive_candidates()
    attendance_names = activity_attendance_names()

    existing_by_name = {normalize_name(m["identity"]["name"]): m for m in master["members"]}
    existing_names = set(existing_by_name.keys())
    existing_ids = {m["identity"]["userId"] for m in master["members"]}
    added = []
    unresolved = []

    for name in sorted(attendance_names, key=lambda value: value):
        canonical = normalize_name(name)
        candidate = candidates.get(canonical) or {}
        poster = poster_index.get(canonical)
        if not candidate and not poster and canonical not in MANUAL_IDS:
            unresolved.append(canonical)
            continue
        member = member_from_sources(canonical, candidate, poster)
        existing_member = existing_by_name.get(canonical)
        if existing_member:
            source = ((existing_member.get("import") or {}).get("source") or "")
            if existing_member.get("memberStatus") == "alumni" and source == "official-xlsx-historical-attendance":
                member["identity"]["userId"] = existing_member["identity"]["userId"]
                idx = master["members"].index(existing_member)
                master["members"][idx] = member
            continue
        base_user_id = member["identity"]["userId"]
        if base_user_id in existing_ids:
            member["identity"]["userId"] = f"{base_user_id}-hist"
        existing_ids.add(member["identity"]["userId"])
        existing_names.add(canonical)
        master["members"].append(member)
        added.append({
            "name": canonical,
            "userId": member["identity"]["userId"],
            "source": "poster" if poster else ("archive" if candidate else "minimal"),
        })

    master["generatedAt"] = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    with open(MASTER_PATH, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(json.dumps({
        "attendanceNames": len(attendance_names),
        "members": len(master["members"]),
        "added": added,
        "unresolved": unresolved,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
