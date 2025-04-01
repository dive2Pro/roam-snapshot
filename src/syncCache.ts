import { Toaster } from "@blueprintjs/core";
import { dbOperator } from "./dbOperator";
import { roamCacheUrl } from "./RoamCacheUrl";

/**
 *
 * @deprecated no more sync
 */
export async function syncCache() {
  const dbOperatorTime = await dbOperator.getUpdateTime();
  console.log(
    `dbOperatorTime: ${dbOperatorTime}, roamCacheUrl.getUrlChangeTime(): ${roamCacheUrl.getUrlChangeTime()}`
  )
  // 如果早于 url 改变的时间, 请求 url 上的数据写入到本地缓存
  if (dbOperatorTime < roamCacheUrl.getUrlChangeTime()) {
    await pullFromUrlCacheToLocal();
  }
  roamCacheUrl.deletePage();
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
    console.error(`updating error!!!`, e);
  } finally {
    toaster.dismiss(toastKey);
  }
}
