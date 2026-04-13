const fs = require('fs');
const path = require('path');

const projectPath = path.resolve(__dirname, '..');
const rawDataPath = path.join(projectPath, 'data', 'yolo-2025-member-posters.json');
const outputPath = path.join(projectPath, 'data', 'yolo-2025-members.master.json');
const mediaMapPath = path.join(projectPath, 'data', 'cloud-media-map.json');
const defaultJoinDate = process.env.DEFAULT_JOIN_DATE || '2025-01';
const mediaMap = fs.existsSync(mediaMapPath)
  ? JSON.parse(fs.readFileSync(mediaMapPath, 'utf8'))
  : { assets: {} };

const cityMap = {
  '浙江宁波': '宁波',
  '江苏无锡': '无锡',
  '广东广州': '广州',
  '江苏苏州': '苏州',
  '浙江杭州': '杭州',
  '美国西雅图': '西雅图',
  '美国洛杉矶': '洛杉矶',
  '美国费城': '费城',
  '广东深圳': '深圳',
  '广西桂林': '桂林',
  '广东深圳，美国湾区': '深圳 / 美国湾区'
};

function isCommunityRole(value) {
  const normalized = normalizeString(value);
  return /理事|创始人/.test(normalized);
}

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean);
  }
  const normalized = normalizeString(value);
  return normalized ? [normalized] : [];
}

function normalizeCity(value) {
  const normalized = normalizeString(value);
  return cityMap[normalized] || normalized;
}

function normalizeGallup(values) {
  return ensureArray(values).map((item) => item.replace(/任责/g, '责任'));
}

function splitCompanyCareer(value, fallbackCareer) {
  const normalized = normalizeString(value);
  const fallback = normalizeString(fallbackCareer);
  if (!normalized) {
    return { company: null, career: fallback || null };
  }

  for (const separator of ['-', '—', '–']) {
    const index = normalized.lastIndexOf(separator);
    if (index > 0) {
      return {
        company: normalizeOptionalString(normalized.slice(0, index)),
        career: normalizeOptionalString(normalized.slice(index + 1)) || fallback || null
      };
    }
  }

  if (/(公司|集团|科技|资本|音乐剧|大学|商学院|JobWizard\.ai|garmentHERE|Limited)/.test(normalized)) {
    return { company: normalized, career: fallback || null };
  }

  return { company: null, career: normalized || fallback || null };
}

function buildUserId(rawMember) {
  const source = normalizeString(rawMember.englishName || rawMember.name || `page-${rawMember.page}`);
  const slug = source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `pdf2025-${slug || `p${String(rawMember.page).padStart(2, '0')}`}`;
}

function buildMasterMember(rawMember, userId) {
  const rawRole = normalizeOptionalString(rawMember.yoloRole);
  const normalizedRole = isCommunityRole(rawRole) ? rawRole : null;
  const companyCareer = splitCompanyCareer(
    rawMember.company,
    normalizedRole ? null : rawRole
  );

  const avatarRef = `/images/avatars/${userId}.jpg`;
  return {
    source: {
      pdf: '【PDF版本】YOLO+2025会员海报合集(1).pdf',
      page: rawMember.page,
      type: 'poster'
    },
    identity: {
      userId,
      name: normalizeString(rawMember.name),
      englishName: normalizeOptionalString(rawMember.englishName)
    },
    community: {
      role: normalizedRole,
      joinDate: defaultJoinDate,
      joinPeriods: [{ start: defaultJoinDate, end: null }]
    },
    profile: {
      motto: normalizeOptionalString(rawMember.motto),
      birthday: normalizeOptionalString(rawMember.birthday),
      city: normalizeOptionalString(normalizeCity(rawMember.city)),
      education: ensureArray(rawMember.education),
      companyCareerRaw: normalizeOptionalString(rawMember.company),
      company: companyCareer.company,
      career: companyCareer.career,
      gallup: normalizeGallup(rawMember.gallup)
    },
    interests: {
      hobbies: ensureArray(rawMember.hobbies),
      travelDestinations: ensureArray(rawMember.travelDestination),
      favoriteSingers: ensureArray(rawMember.favoriteSinger)
    },
    notes: ensureArray(rawMember.notes),
    raw: {
      yoloRoleText: rawRole,
      cityText: normalizeOptionalString(rawMember.city)
    },
    assets: {
      avatarImage: (mediaMap.assets && mediaMap.assets[avatarRef] && mediaMap.assets[avatarRef].fileID) || avatarRef
    },
    import: {
      dataType: 'real',
      source: 'yolo-2025-member-posters-pdf'
    }
  };
}

function main() {
  const rawMembers = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
  const usedUserIds = new Set();
  const members = rawMembers.map((rawMember) => {
    const baseUserId = buildUserId(rawMember);
    let userId = baseUserId;
    if (usedUserIds.has(userId)) {
      userId = `${baseUserId}-p${String(rawMember.page).padStart(2, '0')}`;
    }
    usedUserIds.add(userId);
    return buildMasterMember(rawMember, userId);
  });
  const master = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourcePdfPath: '/Users/Sean/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxwxwx284260582_29ca/msg/file/2026-03/【PDF版本】YOLO+2025会员海报合集(1).pdf',
    defaultJoinDate,
    members: members
  };
  fs.writeFileSync(outputPath, JSON.stringify(master, null, 2) + '\n');
  console.log(outputPath);
  console.log(`members=${master.members.length}`);
}

main();
