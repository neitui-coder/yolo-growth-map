/**
 * import-v2.js
 *
 * Normalized schema v2 import script. Replaces import-real-members.js.
 *
 * Key differences from v1:
 *  - Reads activities from yolo-activities-collection.json (schemaVersion 2)
 *  - User nodes are lightweight refs (no embedded activity details)
 *  - Pushes activities collection to cloud via seedActivities
 *  - Then pushes users via replaceUsersByDataType
 */

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');
const MiniProgram = require('miniprogram-automator/out/MiniProgram').default;

// ─── Paths & config ───────────────────────────────────────────────────────────
const projectPath = path.resolve(__dirname, '..');
const masterPath = path.join(projectPath, 'data', 'yolo-2025-members.master.json');
const activitiesCollectionPath = path.join(projectPath, 'data', 'yolo-activities-collection.json');
const wsEndpoint = process.env.AUTOMATOR_WS_ENDPOINT || 'ws://localhost:9420';
const isDryRun = process.argv.includes('--dry-run');

// Bypass version check so we can connect to an already-open DevTools session
MiniProgram.prototype.checkVersion = async () => true;

// ─── Utility helpers ──────────────────────────────────────────────────────────
function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean);
  }
  const normalized = normalizeString(value);
  return normalized ? [normalized] : [];
}

function cleanObject(value) {
  if (Array.isArray(value)) {
    return value.map(cleanObject).filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === '_id') continue;
      const cleaned = cleanObject(item);
      if (cleaned === undefined) continue;
      next[key] = cleaned;
    }
    return next;
  }
  if (value === undefined) return undefined;
  return value;
}

// ─── Node building (v2 simplified) ───────────────────────────────────────────
/**
 * Build lightweight node refs for one user.
 *
 * Each node is either:
 *   - join  : { nodeId, type:'join', date, desc }
 *   - activity ref : { nodeId, activityKey, role, joinedDate, type, collectiveActivity }
 *
 * No embedded activity details — the client resolves full details via activityKey.
 */
function buildNodes(activitiesCollection, userId, joinDate) {
  const activities = (activitiesCollection && activitiesCollection.activities) || [];

  const joinNode = {
    nodeId: 'n-join-' + userId,
    type: 'join',
    date: joinDate,
    desc: '加入YOLO+'
  };

  const activityNodes = activities
    .filter((a) => Array.isArray(a.participants) && a.participants.some((p) => p.userId === userId))
    .map((a) => {
      const participantEntry = a.participants.find((p) => p.userId === userId);
      return {
        nodeId: 'n-act-' + a.activityKey + '-' + userId,
        activityKey: normalizeString(a.activityKey),
        role: (participantEntry && participantEntry.role) || '',
        joinedDate: normalizeString(a.date),
        type: normalizeString(a.type) || 'activity',
        collectiveActivity: a.collectiveActivity !== false
      };
    });

  // Merge and sort by date descending (join uses .date, activity refs use .joinedDate)
  const allNodes = [joinNode, ...activityNodes].sort((a, b) => {
    const da = a.date || a.joinedDate || '';
    const db = b.date || b.joinedDate || '';
    return db.localeCompare(da);
  });

  return allNodes;
}

// ─── User builder ─────────────────────────────────────────────────────────────
function buildImportUser(master, activitiesCollection, member) {
  const identity = member.identity || {};
  const community = member.community || {};
  const profile = member.profile || {};
  const interests = member.interests || {};
  const assets = member.assets || {};
  const joinDate = normalizeString(community.joinDate || master.defaultJoinDate || '2025-01');
  const userId = normalizeString(identity.userId);

  return cleanObject({
    userId,
    name: normalizeString(identity.name),
    englishName: normalizeString(identity.englishName),
    motto: normalizeString(profile.motto),
    birthday: normalizeString(profile.birthday),
    education: ensureArray(profile.education).join('；'),
    company: normalizeString(profile.company),
    career: normalizeString(profile.career),
    city: normalizeString(profile.city),
    mbti: normalizeString(profile.mbti),
    gallup: ensureArray(profile.gallup),
    hobbies: ensureArray(interests.hobbies),
    expertise: [],
    yoloRole: normalizeString(community.role),
    travelDestination: ensureArray(interests.travelDestinations),
    favoriteSinger: ensureArray(interests.favoriteSingers),
    posterNotes: ensureArray(member.notes),
    source: normalizeString(member.import && member.import.source) || 'yolo-2025-member-posters-pdf',
    sourcePdf: normalizeString(member.source && member.source.pdf),
    sourcePdfPath: normalizeString(master.sourcePdfPath),
    posterPage: member.source && member.source.page,
    avatarImage: normalizeString(assets.avatarImage),
    avatarSeed: normalizeString(identity.name || identity.userId),
    avatarStyle: 'adventurer-neutral',
    dataType: normalizeString(member.import && member.import.dataType) || 'real',
    memberStatus: normalizeString(member.memberStatus) || 'active',
    isFounder: member.isFounder === true,
    joinDate,
    joinPeriods: Array.isArray(community.joinPeriods) && community.joinPeriods.length
      ? community.joinPeriods
      : [{ start: joinDate, end: null }],
    nodes: buildNodes(activitiesCollection, userId, joinDate),
    qa: [],
    skills: [],
    tags: [],
    comments: {},
    likes: {},
    goal: null
  });
}

// ─── Cloud call helper ────────────────────────────────────────────────────────
async function cloudCall(miniProgram, data) {
  return miniProgram.evaluate((payload) => {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'yoloFunctions',
        data: payload,
        success: (r) => resolve(r.result),
        fail: (e) => reject(e)
      });
    });
  }, data);
}

// ─── Cloud operations ─────────────────────────────────────────────────────────
async function seedActivities(miniProgram, activitiesCollection) {
  return cloudCall(miniProgram, {
    type: 'seedActivities',
    activities: activitiesCollection.activities
  });
}

async function replaceUsers(miniProgram, users) {
  return cloudCall(miniProgram, {
    type: 'replaceUsersByDataType',
    dataType: 'real',
    users
  });
}

async function safeClose(miniProgram) {
  if (!miniProgram) return;
  await Promise.race([
    miniProgram.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Read input data
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  const activitiesCollection = JSON.parse(fs.readFileSync(activitiesCollectionPath, 'utf8'));

  // Build all user objects with simplified nodes
  const users = (master.members || []).map((member) =>
    buildImportUser(master, activitiesCollection, member)
  );

  console.log(JSON.stringify({
    dryRun: isDryRun,
    users: users.length,
    activities: activitiesCollection.activities.length,
    sampleNodes: users[0] ? { userId: users[0].userId, nodes: users[0].nodes } : null
  }, null, 2));

  if (isDryRun) {
    console.log('Dry run — no cloud writes performed.');
    return;
  }

  // Connect to miniprogram DevTools
  const mp = await automator.connect({ wsEndpoint });

  try {
    // 1. Push activities collection
    const activitiesResult = await seedActivities(mp, activitiesCollection);
    console.log('seedActivities result:', JSON.stringify(activitiesResult));

    // 2. Push users
    const usersResult = await replaceUsers(mp, users);
    console.log('replaceUsersByDataType result:', JSON.stringify(usersResult));

    // 3. Summary report
    console.log(JSON.stringify({
      users: users.length,
      activities: activitiesCollection.activities.length,
      status: 'ok'
    }));
  } finally {
    await safeClose(mp);
  }
}

main().catch((err) => {
  console.error(err && (err.stack || err.message || err));
  process.exit(1);
});
