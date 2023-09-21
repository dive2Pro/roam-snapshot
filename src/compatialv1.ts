import { Toaster } from "@blueprintjs/core";
import { markHasUpgrade, API } from "./config";
import { cache } from "./cache";
import { isSnapshotKey } from "./CONSTANTS";

// 兼容v1方法

export async function compatialv1() {
  const savedObj = getAllSettings();
  // console.log("savedKeys", savedKeys);
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
          (window.roamAlphaAPI as unknown as RoamExtensionAPI).file
            .get({ url })
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
    const allSettings = API.settings.getAll();
    const pageHistories = Object.keys(allSettings)
      .filter((key) => {
        return isSnapshotKey(key);
      })
      .map((k) => [k, API.settings.get(k) as string]);

    return [
      [
        "rm-history-08-10-2023",
        "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fthoughtfull%2F5N7aGHUhnc.json?alt=media&token=da6fc56b-a31d-4a62-afdd-ad94424a235b",
      ],
    ];
  }
}
