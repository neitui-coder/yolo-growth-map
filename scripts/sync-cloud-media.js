const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const projectPath = path.resolve(__dirname, "..");
const cloudBaseRcPath = path.join(projectPath, "cloudbaserc.json");
const authPath = path.join(
  process.env.HOME,
  ".config",
  ".cloudbase",
  "auth.json",
);
const sdkPath = path.join(
  projectPath,
  "cloudfunctions",
  "yoloFunctions",
  "node_modules",
  "wx-server-sdk",
);
const masterPath = path.join(
  projectPath,
  "data",
  "yolo-2025-members.master.json",
);
const activitiesPath = path.join(
  projectPath,
  "data",
  "yolo-2025-activities.real.json",
);
const mediaMapPath = path.join(projectPath, "data", "cloud-media-map.json");
const miniprogramRoot = path.join(projectPath, "miniprogram");
const sourceMediaRoot = path.join(projectPath, "assets-source");
const isDryRun = process.argv.includes("--dry-run");

function readJson(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) return fallbackValue;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function normalizeAssetRef(ref) {
  return typeof ref === "string" ? ref.trim() : "";
}

function toLocalAssetRef(ref, folderName) {
  var normalized = normalizeAssetRef(ref);
  if (!normalized) return "";
  if (normalized.indexOf("/images/") === 0) return normalized;
  var basename = path.basename(normalized.split("?")[0]);
  return "/images/" + folderName + "/" + basename;
}

function toLocalFilePath(assetRef) {
  var normalized = assetRef.replace(/^\//, "");
  var packagedPath = path.join(miniprogramRoot, normalized);
  if (fs.existsSync(packagedPath)) return packagedPath;
  return path.join(sourceMediaRoot, normalized);
}

function buildCloudPath(assetRef) {
  var normalized = assetRef.replace(/^\//, "");
  if (normalized.indexOf("images/avatars/") === 0) {
    return "yolo-growth-map/media/avatars/" + path.basename(normalized);
  }
  if (normalized.indexOf("images/activity-review/") === 0) {
    return "yolo-growth-map/media/activity-review/" + path.basename(normalized);
  }
  return "yolo-growth-map/media/" + normalized;
}

function collectAvatarJobs(master) {
  return (master.members || [])
    .map(function (member) {
      var localRef = toLocalAssetRef(
        member &&
          member.assets &&
          member.assets.avatarImage,
        "avatars",
      );
      return {
        kind: "avatar",
        localRef: localRef,
        localPath: toLocalFilePath(localRef),
        cloudPath: buildCloudPath(localRef),
      };
    })
    .filter(function (job, index, list) {
      return job.localRef && list.findIndex(function (item) { return item.localRef === job.localRef; }) === index;
    });
}

function collectActivityJobs(activities) {
  var jobs = [];
  (activities.activities || []).forEach(function (activity) {
    (activity.images || []).forEach(function (imageRef) {
      var localRef = toLocalAssetRef(imageRef, "activity-review");
      if (!localRef) return;
      jobs.push({
        kind: "activity",
        localRef: localRef,
        localPath: toLocalFilePath(localRef),
        cloudPath: buildCloudPath(localRef),
      });
    });
  });
  return jobs.filter(function (job, index, list) {
    return list.findIndex(function (item) { return item.localRef === job.localRef; }) === index;
  });
}

function loadCloudRuntime() {
  var cloudBaseRc = readJson(cloudBaseRcPath, null);
  if (!cloudBaseRc || !cloudBaseRc.envId) {
    throw new Error("Missing envId in " + cloudBaseRcPath);
  }
  var auth = readJson(authPath, null);
  if (!auth || !auth.credential) {
    throw new Error("Missing CloudBase auth at " + authPath);
  }
  return {
    envId: cloudBaseRc.envId,
  };
}

function getFileIdPrefix(mediaMap, envId) {
  var assets = mediaMap && mediaMap.assets ? mediaMap.assets : {};
  var exampleKey = Object.keys(assets).find(function (key) {
    return assets[key] && assets[key].fileID && assets[key].cloudPath;
  });

  if (exampleKey) {
    var example = assets[exampleKey];
    var prefix = example.fileID.slice(
      0,
      example.fileID.length - example.cloudPath.length,
    );
    if (prefix) return prefix;
  }

  return "cloud://" + envId + ".636c-" + envId + "-1306756329/";
}

function uploadWithCli(job, envId) {
  childProcess.execFileSync(
    "cloudbase",
    ["storage", "upload", job.localPath, job.cloudPath, "-e", envId],
    {
      cwd: projectPath,
      stdio: "pipe",
      maxBuffer: 1024 * 1024 * 8,
    },
  );
}

async function uploadJobs(jobs) {
  var runtime = loadCloudRuntime();
  var mediaMap = readJson(mediaMapPath, {
    schemaVersion: 1,
    generatedAt: "",
    envId: runtime.envId,
    assets: {},
  });
  var fileIdPrefix = getFileIdPrefix(mediaMap, runtime.envId);

  for (var i = 0; i < jobs.length; i++) {
    var job = jobs[i];
    if (!fs.existsSync(job.localPath)) {
      throw new Error("Missing local asset: " + job.localPath);
    }
    if (isDryRun) {
      mediaMap.assets[job.localRef] = {
        localRef: job.localRef,
        localPath: job.localPath,
        cloudPath: job.cloudPath,
        fileID: fileIdPrefix + job.cloudPath,
      };
      continue;
    }
    uploadWithCli(job, runtime.envId);
    mediaMap.assets[job.localRef] = {
      localRef: job.localRef,
      localPath: job.localPath,
      cloudPath: job.cloudPath,
      fileID: fileIdPrefix + job.cloudPath,
      updatedAt: new Date().toISOString(),
    };
  }

  mediaMap.generatedAt = new Date().toISOString();
  mediaMap.envId = runtime.envId;
  writeJson(mediaMapPath, mediaMap);
  return mediaMap;
}

function applyMediaMapToMaster(master, mediaMap) {
  var assets = mediaMap.assets || {};
  master.members = (master.members || []).map(function (member) {
    var localRef = toLocalAssetRef(
      member &&
        member.assets &&
        member.assets.avatarImage,
      "avatars",
    );
    var mapped = assets[localRef];
    if (!mapped || !mapped.fileID) return member;
    member.assets = member.assets || {};
    member.assets.avatarImage = mapped.fileID;
    return member;
  });
  return master;
}

function applyMediaMapToActivities(activityData, mediaMap) {
  var assets = mediaMap.assets || {};
  activityData.activities = (activityData.activities || []).map(function (activity) {
    activity.images = (activity.images || []).map(function (imageRef) {
      var localRef = toLocalAssetRef(imageRef, "activity-review");
      var mapped = assets[localRef];
      return mapped && mapped.fileID ? mapped.fileID : imageRef;
    });
    return activity;
  });
  return activityData;
}

async function main() {
  var master = readJson(masterPath, null);
  var activities = readJson(activitiesPath, null);
  if (!master || !activities) {
    throw new Error("Missing master or activity data JSON");
  }

  var jobs = collectAvatarJobs(master).concat(collectActivityJobs(activities));
  var mediaMap = await uploadJobs(jobs);
  var nextMaster = applyMediaMapToMaster(master, mediaMap);
  var nextActivities = applyMediaMapToActivities(activities, mediaMap);

  if (!isDryRun) {
    writeJson(masterPath, nextMaster);
    writeJson(activitiesPath, nextActivities);
  }

  console.log(
    JSON.stringify(
      {
        dryRun: isDryRun,
        avatarCount: collectAvatarJobs(master).length,
        activityImageCount: collectActivityJobs(activities).length,
        totalUploaded: jobs.length,
        mediaMapPath: mediaMapPath,
        masterPath: masterPath,
        activitiesPath: activitiesPath,
      },
      null,
      2,
    ),
  );
}

main().catch(function (error) {
  console.error(error && (error.stack || error.message || error));
  process.exit(1);
});
