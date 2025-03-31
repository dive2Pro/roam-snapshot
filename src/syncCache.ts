import { Toaster } from "@blueprintjs/core";
import { emitCacheChangeEvent } from "./event";
import { dbOperator } from "./dbOperator";
import { roamCacheUrl } from "./RoamCacheUrl";
import { compatialv1 } from "./compatialv1";
import { hasUpgrade } from "./config";

/**
 * 
 * @deprecated no more sync 
 */
async function syncCache() {
  const dbOperatorTime = await dbOperator.getUpdateTime();
  // 如果本地缓存的更新时间晚于 url 改变的时间, 触发上传的倒计时
  if (dbOperatorTime > roamCacheUrl.getUrlChangeTime()) {
    emitCacheChangeEvent("");
  }
  // 如果早于 url 改变的时间, 请求 url 上的数据写入到本地缓存
  else if (dbOperatorTime < roamCacheUrl.getUrlChangeTime()) {
    pullFromUrlCacheToLocal();
  }
  // 如果没有本地缓存, 也没有 url, 则检查是否需要兼容.
  else {
    if (hasUpgrade()) {
      return;
    }
    compatialv1();
  }
}

async function pullFromUrlCacheToLocal() {
  const toaster = Toaster.create({});
  const toastKey = toaster.show({
    message: `Updating Page History from Remote Cache`,
    intent: "success",
    timeout: 0,
    icon: "cloud-download",
  });

  try {
    const file = await (
      window.roamAlphaAPI as unknown as RoamExtensionAPI
    ).file.get({ url: roamCacheUrl.url });
    const data = JSON.parse(await file.text());
    await dbOperator.replaceWith(data);
  } catch (e) {
    console.error(`updating error`, e);
  } finally {
    toaster.dismiss(toastKey);
  }
}
