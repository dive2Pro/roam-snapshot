import { API } from "./config";

class RemoteCache {
  async add(key: string, value: any) {
    const oldUrl = await fileUrlCache.get(key);
    await API.settings.set(key, 1); // 关闭写入通道, 因为已经进入写入流程了, 避免重复写入

    const url = await (
      window.roamAlphaAPI as unknown as RoamExtensionAPI
    ).file.upload({
      file: new File([JSON.stringify(value)], `${key}.json`, {
        type: "application/json",
      }),
      toast: { hide: true },
    });
    console.log(url, " = url");
    await fileUrlCache.add(key, url);
    if (oldUrl && url) {
      (window.roamAlphaAPI as unknown as RoamExtensionAPI).file.delete({
        url: oldUrl,
      });
      console.log(`deleting: ${oldUrl}`);
    }
    return url;
  }
  async get(key: string) {
    const url = await fileUrlCache.get(key);
    if (!url) {
      return undefined;
    }

    try {
      const file = await (
        window.roamAlphaAPI as unknown as RoamExtensionAPI
      ).file.get({ url });
      return JSON.parse(await file.text());
    } catch (e) {
      console.warn(e, key, url);
      return undefined;
    }
  }
}
class FileUrlCache {
  async add(key: string, url: string) {
    await API.settings.set(key, url);
    localStorage.setItem(key, url);
  }

  async get(key: string) {
    const remoteValue = API.settings.get(key) as string;
    const localValue = localStorage.getItem(key);

    return remoteValue || localValue;
  }
}
const fileUrlCache = new FileUrlCache();
const remoteCache = new RemoteCache();// incase of uninstall plugin occasionally
