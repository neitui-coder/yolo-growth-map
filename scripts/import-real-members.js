const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');
const MiniProgram = require('miniprogram-automator/out/MiniProgram').default;

const projectPath = path.resolve(__dirname, '..');
const masterPath = path.join(projectPath, 'data', 'yolo-2025-members.master.json');
const activitiesPath = path.join(projectPath, 'data', 'yolo-2025-activities.real.json');
const cliPath = process.env.WECHAT_CLI_PATH || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const defaultJoinDate = process.env.DEFAULT_JOIN_DATE || '2025-01';
const wsEndpoint = process.env.AUTOMATOR_WS_ENDPOINT || '';
const isDryRun = process.argv.includes('--dry-run');

MiniProgram.prototype.checkVersion = async () => true;

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
    return value
      .map(cleanObject)
      .filter((item) => item !== undefined);
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

function buildCollectiveActivityNodes(activitySource, userId) {
  const activities = (activitySource && activitySource.activities) || [];
  return activities
    .filter((activity) => Array.isArray(activity.participantUserIds) && activity.participantUserIds.indexOf(userId) !== -1)
    .map((activity) => ({
      date: normalizeString(activity.date),
      desc: normalizeString(activity.title),
      summary: normalizeString(activity.summary),
      location: normalizeString(activity.location),
      images: ensureArray(activity.images),
      type: normalizeString(activity.type) || 'activity',
      activityKey: normalizeString(activity.activityKey),
      collectiveActivity: activity.collectiveActivity !== false
    }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function buildImportUser(master, activitySource, member) {
  const identity = member.identity || {};
  const community = member.community || {};
  const profile = member.profile || {};
  const interests = member.interests || {};
  const assets = member.assets || {};
  const joinDate = community.joinDate || master.defaultJoinDate || defaultJoinDate;
  const collectiveNodes = buildCollectiveActivityNodes(activitySource, normalizeString(identity.userId));
  const joinNode = { date: joinDate, desc: '加入YOLO+', images: [], type: 'activity', collectiveActivity: false };

  return cleanObject({
    userId: normalizeString(identity.userId),
    name: normalizeString(identity.name),
    englishName: normalizeString(identity.englishName),
    motto: normalizeString(profile.motto),
    birthday: normalizeString(profile.birthday),
    education: ensureArray(profile.education).join('；'),
    company: normalizeString(profile.company),
    career: normalizeString(profile.career),
    city: normalizeString(profile.city),
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
    nodes: collectiveNodes.concat([joinNode]),
    qa: [],
    skills: [],
    tags: [],
    comments: {},
    likes: {},
    goal: null
  });
}

function buildStats(users) {
  const counts = {
    total: users.length,
    withAvatarImage: 0,
    withMotto: 0,
    withBirthday: 0,
    withEducation: 0,
    withCompany: 0,
    withCareer: 0,
    withCity: 0,
    withGallup: 0,
    withHobbies: 0,
    withTravelDestination: 0,
    withFavoriteSinger: 0,
    withYoloRole: 0
  };

  users.forEach((user) => {
    if (user.avatarImage) counts.withAvatarImage++;
    if (user.motto) counts.withMotto++;
    if (user.birthday) counts.withBirthday++;
    if (user.education) counts.withEducation++;
    if (user.company) counts.withCompany++;
    if (user.career) counts.withCareer++;
    if (user.city) counts.withCity++;
    if ((user.gallup || []).length) counts.withGallup++;
    if ((user.hobbies || []).length) counts.withHobbies++;
    if ((user.travelDestination || []).length) counts.withTravelDestination++;
    if ((user.favoriteSinger || []).length) counts.withFavoriteSinger++;
    if (user.yoloRole) counts.withYoloRole++;
  });

  return counts;
}

function mergeExistingUser(importedUser, existingUser) {
  if (!existingUser) return importedUser;

  const preservedNodes = (existingUser.nodes || []).filter((node) => {
    if (!node) return false;
    if (node.collectiveActivity === true) return false;
    if (node.type === 'activity' && node.desc === '加入YOLO+') return false;
    return true;
  });

  const merged = Object.assign({}, importedUser, {
    qa: Array.isArray(existingUser.qa) ? existingUser.qa : importedUser.qa,
    comments: existingUser.comments || importedUser.comments,
    likes: existingUser.likes || importedUser.likes,
    goal: existingUser.goal || importedUser.goal,
    visibility: existingUser.visibility || importedUser.visibility,
    aiFunnyIntro: existingUser.aiFunnyIntro || importedUser.aiFunnyIntro,
    aiFunnyIntroVersion: existingUser.aiFunnyIntroVersion || importedUser.aiFunnyIntroVersion,
    nodes: importedUser.nodes.concat(preservedNodes).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  });

  ['mbti', 'wechat', 'zodiac', 'company', 'career', 'education', 'city', 'motto', 'memberStatus', 'isFounder'].forEach((field) => {
    if ((!merged[field] || (Array.isArray(merged[field]) && !merged[field].length)) && existingUser[field]) {
      merged[field] = existingUser[field];
    }
  });

  ['skills', 'expertise', 'tags', 'hobbies', 'gallup'].forEach((field) => {
    if ((!merged[field] || !merged[field].length) && Array.isArray(existingUser[field]) && existingUser[field].length) {
      merged[field] = existingUser[field];
    }
  });

  return cleanObject(merged);
}

async function cloudCall(miniProgram, data) {
  return miniProgram.evaluate((payload) => {
    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'yoloFunctions',
        data: payload,
        success: (res) => resolve({ ok: true, result: res.result }),
        fail: (err) => resolve({ ok: false, error: err && (err.errMsg || err.message || String(err)) })
      });
    });
  }, data);
}

async function fetchRealUsers(miniProgram) {
  const response = await cloudCall(miniProgram, { type: 'getUsers', dataType: 'real', pageSize: 100 });
  if (!response.ok || !response.result || !response.result.success) {
    throw new Error(`fetch real users failed: ${JSON.stringify(response)}`);
  }
  return response.result.data || [];
}

async function replaceRealUsers(miniProgram, users) {
  const response = await cloudCall(miniProgram, {
    type: 'replaceUsersByDataType',
    dataType: 'real',
    users
  });
  if (!response.ok || !response.result || !response.result.success) {
    throw new Error(`replace real users failed: ${JSON.stringify(response)}`);
  }
  return response.result;
}

async function switchToRealData(miniProgram) {
  return miniProgram.evaluate((type) => {
    return new Promise((resolve) => {
      const app = getApp();
      app.switchDataType(type, () => resolve(app.globalData.users.length));
    });
  }, 'real');
}

async function ensureAllUsersLoaded(miniProgram) {
  return miniProgram.evaluate(() => {
    return new Promise((resolve) => {
      const app = getApp();
      if (!app.ensureAllUsersLoaded) {
        resolve(app.globalData.users.length);
        return;
      }
      app.ensureAllUsersLoaded(() => resolve(app.globalData.users.length));
    });
  });
}

async function safeClose(miniProgram) {
  if (!miniProgram) return;
  await Promise.race([
    miniProgram.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
}

async function openMiniProgram() {
  if (wsEndpoint) {
    return automator.connect({ wsEndpoint });
  }
  return automator.launch({ cliPath, projectPath });
}

async function verifyScreens(miniProgram, sampleUsers) {
  const indexShot = path.join(projectPath, 'automation-real-index.png');
  const profileShot = path.join(projectPath, 'automation-real-profile.png');

  await switchToRealData(miniProgram);
  await ensureAllUsersLoaded(miniProgram);

  const indexPage = await miniProgram.reLaunch('/pages/index/index');
  await indexPage.waitFor(2500);
  const indexData = await indexPage.data();
  await miniProgram.screenshot({ path: indexShot });

  const verifiedProfiles = [];
  for (const sample of sampleUsers) {
    const profilePage = await miniProgram.reLaunch(`/pages/profile/profile?userId=${sample.userId}`);
    await profilePage.waitFor(2500);
    const profileData = await profilePage.data();
    verifiedProfiles.push({
      userId: sample.userId,
      expectedName: sample.name,
      actualName: profileData.selectedUser && profileData.selectedUser.name,
      avatarUrl: profileData.selectedUser && profileData.selectedUser.avatarUrl,
      gallupCount: profileData.selectedUser && profileData.selectedUser.gallup ? profileData.selectedUser.gallup.length : 0,
      hobbyCount: profileData.selectedUser && profileData.selectedUser.hobbies ? profileData.selectedUser.hobbies.length : 0
    });
  }

  const lastSample = sampleUsers[sampleUsers.length - 1];
  const profilePage = await miniProgram.reLaunch(`/pages/profile/profile?userId=${lastSample.userId}`);
  await profilePage.waitFor(2500);
  await miniProgram.screenshot({ path: profileShot });

  return {
    indexShot,
    profileShot,
    filteredUserCount: indexData.filteredUserCount,
    verifiedProfiles
  };
}

async function main() {
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  const activitySource = JSON.parse(fs.readFileSync(activitiesPath, 'utf8'));
  const users = (master.members || []).map((member) => buildImportUser(master, activitySource, member));
  const stats = buildStats(users);
  let miniProgram;

  try {
    miniProgram = await openMiniProgram();
    const existingUsers = await fetchRealUsers(miniProgram);
    const existingByUserId = existingUsers.reduce((acc, user) => {
      acc[user.userId] = user;
      return acc;
    }, {});
    const mergedUsers = users.map((user) => mergeExistingUser(user, existingByUserId[user.userId]));

    console.log(JSON.stringify({
      existingRealCount: existingUsers.length,
      replacementCount: mergedUsers.length,
      dryRun: isDryRun,
      stats: buildStats(mergedUsers),
      names: mergedUsers.map((user) => user.name)
    }, null, 2));

    if (!isDryRun) {
      const replaceResult = await replaceRealUsers(miniProgram, mergedUsers);
      const afterUsers = await fetchRealUsers(miniProgram);
      const sampleUsers = [mergedUsers[0], mergedUsers[Math.floor(mergedUsers.length / 2)], mergedUsers[mergedUsers.length - 1]];
      const verification = await verifyScreens(miniProgram, sampleUsers);

      console.log(JSON.stringify({
        replaceResult,
        finalRealCount: afterUsers.length,
        verification
      }, null, 2));
    }

    await safeClose(miniProgram);
  } catch (error) {
    console.error(error && (error.stack || error.message || error));
    if (miniProgram) {
      await safeClose(miniProgram);
    }
    process.exit(1);
  }
}

main();
