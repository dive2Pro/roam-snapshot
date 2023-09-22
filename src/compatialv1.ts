import { Toaster } from "@blueprintjs/core";
import { markHasUpgrade, API } from "./config";
import { cache } from "./cache";
import { isSnapshotKey } from "./CONSTANTS";

// 兼容v1方法

export async function compatialv1() {
  const savedObj = getAllSettings();
  console.log("savedKeys", savedObj);
  if (savedObj.length <= 0) {
    markHasUpgrade();
    return;
  }
  const toaster = Toaster.create({});
  const toastKey = toaster.show({
    message: `Upgrading Page History...`,
    intent: "success",
    timeout: 0,
    icon: "cloud-download",
  });
  try {
    await Promise.all(
      savedObj.map(([k, url]) => {
        return new Promise(async (resolve) => {
          
            (window.roamAlphaAPI as unknown as RoamExtensionAPI)
            .file.get({ url })
            .then(async (res) => {
              return JSON.parse(await res.text());
            })
            .then((json) => {
              cache.add(k, json);
            })
            .finally(() => {
              resolve(1);
            });
        });
      })
    );
  } catch (e) {
  } finally {
    markHasUpgrade();
    toaster.dismiss(toastKey);
  }

  function getAllSettings() {
    const allSettings = getOldSettings();

    const pageHistories = Object.keys(allSettings)
      .filter((key) => {
        return isSnapshotKey(key) && allSettings[key].startsWith("https://");
      })
      .map((k) => [k, allSettings[k]]);
    return pageHistories;
  }
}

function getOldSettings() {
  // 获取所有的LocalStorage键
  var keys = Object.keys(localStorage);

  // 创建一个对象来存储所有的键值对
  var localStorageData: Record<string, any> = {};

  // 遍历所有的键，并将其值存储到localStorageData对象中
  keys.forEach(function (key) {
    localStorageData[key] = localStorage.getItem(key);
  });

  // 现在，localStorageData对象包含了所有LocalStorage中的键值对
  console.log(localStorageData);
  return localStorageData;
}
