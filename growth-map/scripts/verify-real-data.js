const path = require('path');
const automator = require('miniprogram-automator');
const MiniProgram = require('miniprogram-automator/out/MiniProgram').default;

const projectPath = path.resolve(__dirname, '..');
const cliPath = process.env.WECHAT_CLI_PATH || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const wsEndpoint = process.env.AUTOMATOR_WS_ENDPOINT || '';

MiniProgram.prototype.checkVersion = async () => true;

async function switchToRealData(miniProgram) {
  return miniProgram.evaluate(() => {
    return new Promise((resolve) => {
      const app = getApp();
      app.switchHomeMode('real', () => resolve(app.globalData.users.length));
    });
  });
}

async function switchToOperatorData(miniProgram) {
  return miniProgram.evaluate(() => {
    return new Promise((resolve) => {
      const app = getApp();
      app.switchHomeMode('operator', () => resolve({
        users: app.globalData.users.length,
        currentUserId: app.globalData.currentUserId,
        operatorModeActive: app.globalData.operatorModeActive
      }));
    });
  });
}

async function readSummary(miniProgram) {
  return miniProgram.evaluate(() => {
    const app = getApp();
    const users = app.globalData.users || [];
    const userIds = new Set();
    const names = new Set();
    const duplicateUserIds = [];
    const duplicateNames = [];

    users.forEach((user) => {
      if (userIds.has(user.userId)) duplicateUserIds.push(user.userId);
      userIds.add(user.userId);
      if (names.has(user.name)) duplicateNames.push(user.name);
      names.add(user.name);
    });

    return {
      total: users.length,
      localAvatarCount: users.filter((user) => typeof user.avatarImage === 'string' && user.avatarImage.indexOf('/images/avatars/') === 0).length,
      cloudAvatarCount: users.filter((user) => typeof user.avatarImage === 'string' && user.avatarImage.indexOf('cloud://') === 0).length,
      missingAvatarCount: users.filter((user) => !user.avatarImage).length,
      duplicateUserIds,
      duplicateNames,
      missingCareerAndCompany: users.filter((user) => !user.career && !user.company).map((user) => user.name),
      missingMotto: users.filter((user) => !user.motto).map((user) => user.name)
    };
  });
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

async function readSearchResults(miniProgram, queries) {
  const indexPage = await miniProgram.reLaunch('/pages/index/index');
  await indexPage.waitFor(1500);

  const results = [];
  for (const query of queries) {
    const result = await miniProgram.evaluate((searchQuery) => {
      const page = getCurrentPages()[getCurrentPages().length - 1];
      page.setData({ searchQuery: searchQuery, activeFilter: '' });
      page._refreshMemberList();
      return {
        query: searchQuery,
        count: page.data.filteredUserCount,
        names: page.data.filteredUsers.map((user) => user.name)
      };
    }, query);
    results.push(result);
  }

  return results;
}

async function readProfiles(miniProgram, userIds) {
  const profiles = [];

  for (const userId of userIds) {
    const profilePage = await miniProgram.reLaunch(`/pages/profile/profile?userId=${userId}`);
    await profilePage.waitFor(1500);
    const data = await profilePage.data();

    profiles.push({
      userId,
      name: data.selectedUser && data.selectedUser.name,
      avatarUrl: data.selectedUser && data.selectedUser.avatarUrl,
      completeness: data.completeness,
      missingFieldsText: data.missingFieldsText,
      company: data.selectedUser && data.selectedUser.company,
      career: data.selectedUser && data.selectedUser.career,
      gallupCount: data.selectedUser && data.selectedUser.gallup ? data.selectedUser.gallup.length : 0,
      hobbiesCount: data.selectedUser && data.selectedUser.hobbies ? data.selectedUser.hobbies.length : 0
    });
  }

  return profiles;
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

async function main() {
  const miniProgram = await openMiniProgram();

  try {
    await switchToRealData(miniProgram);

    const initialSummary = await readSummary(miniProgram);
    const afterEnsureCount = await ensureAllUsersLoaded(miniProgram);
    const summary = await readSummary(miniProgram);
    const searchResults = await readSearchResults(miniProgram, ['周玥', '高秋闲', '宗羱']);
    const profiles = await readProfiles(miniProgram, ['pdf2025-bill', 'pdf2025-sarah-p30', 'pdf2025-eco']);
    const operator = await switchToOperatorData(miniProgram);

    console.log(JSON.stringify({ initialSummary, afterEnsureCount, summary, searchResults, profiles, operator }, null, 2));
  } finally {
    await safeClose(miniProgram);
  }
}

main().catch((error) => {
  console.error(error && (error.stack || error.message || error));
  process.exit(1);
});
