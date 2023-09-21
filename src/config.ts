import { Toast, Toaster } from "@blueprintjs/core";
import { openDB } from "idb";
import { emitCacheChangeEvent, emitStartUploadEvent } from "./event";
import { PullBlock } from "roamjs-components/types";

const dbPromise = openDB("rm-history", 1, {
  upgrade(db) {
    db.createObjectStore(CONSTANTS.DB_STORE);
  },
});

class DBOperator {
  updateTimeKey = "updateTime";
  async update(k: string, value: any) {
    const r = await (await dbPromise).put(CONSTANTS.DB_STORE, value, k);
    this.updateTime();

    return r;
  }

  async get(key: string) {
    return (await dbPromise).get(CONSTANTS.DB_STORE, key);
  }

  private async updateTime() {
    await (
      await dbPromise
    ).put(CONSTANTS.DB_STORE, Date.now(), this.updateTimeKey);
  }

  async getUpdateTime() {
    return (await this.get(this.updateTimeKey)) || 0;
  }

  async replaceWith(data: [string, any][]) {
    console.log("DBOperator: replaceWith: ", data);
    const tx = (await dbPromise).transaction(CONSTANTS.DB_STORE, "readwrite");
    await Promise.all(
      data.map((item) => {
        return tx.store.put(item[1], item[0]);
      })
    );
    await tx.done;
  }
}

const dbOperator = new DBOperator();

const CONSTANTS = {
  PAGE_INTERVAL: "page-interval",
  DB_STORE: "page-history",
  VERSION: "version",
};

class LocalCache {
  async add(key: string, value: any) {
    const r = dbOperator.update(key, value);
    return r.toString();
  }
  async get(key: string) {
    // 兼容 v1 , 如果本地没有,
    console.log(key, " ---");
    return dbOperator.get(getKey(key));
  }
}

// incase of uninstall plugin occasionally
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

const remoteCache = new RemoteCache();

const cache = new LocalCache();

function markHasUpgrade() {
  API.settings.set(CONSTANTS.VERSION, 1);
}
function hasUpgrade(v = 1) {
  return API.settings.get(CONSTANTS.VERSION) === v;
}

// 创建一个兼容方法
async function compatial() {
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

let API: RoamExtensionAPI;
export async function initConfig(extensionAPI: RoamExtensionAPI) {
  API = extensionAPI;
  API.settings.panel.create({
    tabTitle: "Page History",
    settings: [
      {
        id: CONSTANTS.PAGE_INTERVAL,
        name: "Time Interval",
        description:
          "How long should you wait before taking a snapshot of a page after starting to edit it (The unit is minutes)",
        action: {
          type: "input",
          placeholder: "10",
        },
      },
    ],
  });
  const dbOperatorTime = await dbOperator.getUpdateTime();
  // 如果本地缓存的更新时间晚于 url 改变的时间, 触发上传的倒计时
  if (dbOperatorTime > roamCacheUrl.getUrlChangeTime()) {
    emitCacheChangeEvent("");
  }
  // 如果早于 url 改变的时间, 请求 url 上的数据写入到本地缓存
  else if (dbOperatorTime < roamCacheUrl.getUrlChangeTime()) {
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
  // 如果没有本地缓存, 也没有 url, 则检查是否需要兼容.
  else {
    if (hasUpgrade()) {
      // return;
    }
    compatial();
  }
}

export function getIntervalTime() {
  return +API.settings.get(CONSTANTS.PAGE_INTERVAL) || 10;
}

const getKey = (key: string) => {
  return isSnapshotKey(key) ? key : `rm-history-${key}`;
};

const isSnapshotKey = (k: string) => {
  return k.startsWith(`rm-history-`);
};

export async function saveToServer() {
  // 将所有的缓存都保存到服务器.
  const db = await dbPromise;
  const allCacheKeys = await db.getAllKeys(CONSTANTS.DB_STORE);
  const allCacheData = [];
  for await (const k of allCacheKeys) {
    allCacheData.push([k, await db.get(CONSTANTS.DB_STORE, k)]);
  }
  console.log("saveToServer: ", JSON.stringify(allCacheData), allCacheData);
  const url = await (
    window.roamAlphaAPI as unknown as RoamExtensionAPI
  ).file.upload({
    file: new File([JSON.stringify(allCacheData)], `rm-history.json`, {
      type: "application/json",
    }),
    toast: { hide: true },
  });
  return roamCacheUrl.saveUrl(url);
}

const getNthChildUidByBlockUid = ({
  blockUid,
  order,
}: {
  blockUid: string;
  order: number;
}): string =>
  (
    window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?c [:block/uid]) :where [?p :block/uid "${blockUid}"] [?p :block/children ?c] [?c :block/order ${order}] ]`
    )?.[0]?.[0] as PullBlock
  )?.[":block/uid"] || "";

const creaetOrGetFirstChildUidByPageUid = async (pageUid: string) => {
  let uid = getNthChildUidByBlockUid({
    blockUid: pageUid,
    order: 0,
  });
  if (uid) {
    return uid;
  }
  uid = window.roamAlphaAPI.util.generateUID();
  console.log(pageUid, uid, " ---");

  await window.roamAlphaAPI.createBlock({
    block: {
      uid,
      string: "",
    },
    location: {
      "parent-uid": pageUid,
      order: 0,
    },
  });
  return uid;
};

const getTextByBlockUid = (uid = ""): string =>
  (uid &&
    window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid])?.[
      ":block/string"
    ]) ||
  "";
const getEditTimeByBlockUid = (uid = "") =>
  (uid &&
    window.roamAlphaAPI.pull("[:edit/time]", [":block/uid", uid])?.[
      ":edit/time"
    ]) ||
  0;

const getPageUidByPageTitle = (title: string): string =>
  window.roamAlphaAPI.pull("[:block/uid]", [":node/title", title])?.[
    ":block/uid"
  ] || "";

class RoamCacheUrl {
  pageTitle = "roam/plugin/PageHistory";
  pageUid = "";
  firstChildUid = "";
  url = "";
  constructor() {
    this.init();
  }
  async init() {
    await this.getPageUid();
    await this.getFirstChildUid();
    this.loadUrl();
  }
  async getFirstChildUid() {
    this.firstChildUid = await creaetOrGetFirstChildUidByPageUid(this.pageUid);
  }

  async getPageUid() {
    try {
      const uid = await window.roamAlphaAPI.util.generateUID();
      await window.roamAlphaAPI.createPage({
        page: {
          title: this.pageTitle,
          uid,
        },
      });
      this.pageUid = uid;
    } catch (e) {
      // 通过 page/title 获取 uid
      this.pageUid = getPageUidByPageTitle(this.pageTitle);
    }
  }
  saveUrl(url: string) {
    return window.roamAlphaAPI.updateBlock({
      block: {
        uid: this.firstChildUid,
        string: url,
      },
    });
  }

  loadUrl() {
    this.url = getTextByBlockUid(this.firstChildUid);
  }

  getUrlChangeTime() {
    return getEditTimeByBlockUid(this.firstChildUid);
  }
}

const roamCacheUrl = new RoamCacheUrl();

async function saveToCache(key: string, value: any) {
  await cache.add(getKey(key), value);
  // 一旦有记录, 就记录到本地, 触发显示倒计时
  emitCacheChangeEvent(key);
}

async function getFromServer(key: string) {
  return cache.get(getKey(key));
}

export async function hasRecordInServer(key: string) {
  const r = await fileUrlCache.get(getKey(key));
  return !!r;
}

export async function getPageSnapshot(
  page: string
): Promise<{ json: Snapshot; time: number }[]> {
  try {
    console.time("LOADING");
    const result = await getFromServer(page);
    console.log(result, " --- result --- ", getKey(page));
    if (!result) {
      // 不能写空, 有可能 result = undefined 是因为数据请求为空
      // API.settings.set(getKey(page), undefined);
      return [];
    }
    if (typeof result === "string") return JSON.parse(result as string) as [];
    return result;
  } catch (e) {
    console.log(e, " --");
    return [];
  } finally {
    console.timeEnd("LOADING");
  }
}
export const keys = <T extends {}>(obj: T) => {
  return Object.keys(obj) as unknown as (keyof T)[];
};
const compareKeys = [
  "open",
  "string",
  "text-align",
  "heading",
  "view-type",
  "order",
] as (keyof SnapshotBlock)[];

const hasDifferenceWith = (a: SnapshotBlock, b: SnapshotBlock) => {
  const aKeys = [...compareKeys, "children"] as (keyof SnapshotBlock)[];
  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i];
    if (key === "parents") {
      continue;
    }
    if (key === "children") {
      if (a[key]?.length !== b[key]?.length) {
        console.log("DIFF: ", key, a[key], b[key]);
        return true;
      }
      continue;
    }
    if (key === "time") {
      continue;
    }
    if (!fieldEqual(key, a[key], b[key])) {
      console.log("DIFF: ", key, a[key], b[key]);
      return true;
    }
  }
  if (b.children === undefined) {
    return false;
  }
  const aChildren = a.children.sort(sortByOrder);
  const bChildren = b.children.sort(sortByOrder);
  for (let i = 0; i < a.children.length; i++) {
    if (hasDifferenceWith(aChildren[i], bChildren[i])) {
      return true;
    }
  }
  return false;
};

export const sortByOrder = (a: SnapshotBlock, b: SnapshotBlock) =>
  a.order - b.order;
const hasDifference = (a: Snapshot, b: Snapshot) => {
  if (a.title !== b.title) {
    return true;
  }
  if (a.children.length !== b.children.length) {
    return true;
  }
  const aChildren = a.children.sort(sortByOrder);
  const bChildren = b.children.sort(sortByOrder);
  for (let i = 0; i < a.children.length; i++) {
    if (hasDifferenceWith(aChildren[i], bChildren[i])) {
      return true;
    }
  }
  return false;
};

export async function savePageSnapshot(pageUid: string, snapshot: Snapshot) {
  const old = await getPageSnapshot(pageUid);
  // 两个最近的 json 之间有差异, 才插入;
  const sorted = old.sort((a, b) => {
    return b.time - a.time;
  });
  if (sorted.length) {
    if (hasDifference(sorted[0].json, snapshot)) {
      sorted.unshift({
        json: snapshot,
        time: Date.now(),
      });
    } else {
      return;
    }
  } else {
    sorted.unshift({
      json: snapshot,
      time: Date.now(),
    });
  }
  saveToCache(pageUid, sorted);
}

export async function deletePageSnapshot(pageUid: string, time: number) {
  const old = await getPageSnapshot(pageUid);
  const sorted = old.sort((a, b) => {
    return b.time - a.time;
  });

  const filtered = sorted.filter((item) => item.time !== time);
  console.log(pageUid, sorted, filtered, " -----@@----");
  await saveToCache(pageUid, filtered);
  return filtered;
}

export async function diffSnapshot(
  pageUid: string,
  snapshots: { json: Snapshot; time: number }[],
  now: number,
  old: number
) {
  // const snapshots = await getPageSnapshot(pageUid);
  if (!snapshots.length) {
    return undefined;
  }
  if (old >= snapshots.length) {
    return undefined;
  }
  const diff = {};
  diffSnapshots(diff, snapshots[now].json, snapshots[old].json);
  console.log(diff, snapshots[now], snapshots[old], " ------ dddd");
  return diff;
}

export const diffSnapshots = (diff: Diff, now: Snapshot, old: Snapshot) => {
  if (now.title !== old.title) {
    diff.title = {
      old: old.title,
      now: now.title,
    };
  }
  if (!old.children?.length && now.children?.length) {
    diff.block = {
      added: now.children.map((child) => ({
        ...child,
        parentUids: [now.uid],
        added: true,
      })),
    };
  } else if (old.children.length && !now.children?.length) {
    diff.block = {
      deleted: old.children.map((child) => ({
        ...child,
        parentUids: [now.uid],
        deleted: true,
      })),
    };
  } else {
    diff.block = {
      added: [],
      deleted: [],
      changed: {},
    };

    const nowChildren = now.children.sort(sortByOrder);
    const oldChildren = old.children.sort(sortByOrder);
    const nowChildrenMap = (now.children || []).reduce((p, c) => {
      p[c.uid] = c;
      return p;
    }, {} as Record<string, SnapshotBlock>);

    const oldChildrenMap = (old.children || []).reduce((p, c) => {
      p[c.uid] = c;
      return p;
    }, {} as Record<string, SnapshotBlock>);
    // TODO: 不以 order 上是否相等为判断新增更新的标准.因为这样会让 只是 order 变化的 block 也被识别为 added 和 deleted
    keys(nowChildrenMap).forEach((key) => {
      if (oldChildrenMap[key]) {
        diffSnapshotBlock(
          diff,
          [now.uid],
          nowChildrenMap[key],
          oldChildrenMap[key]
        );
        delete nowChildrenMap[key];
        delete oldChildrenMap[key];
      } else {
      }
    });
    keys(nowChildrenMap).forEach((key) => {
      diff.block.added.push({
        parentUids: [now.uid],
        ...nowChildrenMap[key],
        added: true,
      });
    });
    keys(oldChildrenMap).forEach((key) => {
      diff.block.deleted.push({
        parentUids: [now.uid],
        ...oldChildrenMap[key],
        deleted: true,
      });
    });
    return;
    const nowlength = nowChildren.length;
    const oldlength = oldChildren.length;
    let order = 0;
    for (order = 0; order < Math.min(nowlength, oldlength); order++) {
      diffSnapshotBlock(
        diff,
        [now.uid],
        nowChildren[order],
        oldChildren[order]
      );
    }
    if (nowlength > oldlength) {
      nowChildren.slice(order).forEach((child) => {
        diff.block.added.push({
          parentUids: [now.uid],
          ...child,
          added: true,
        });
      });
    } else if (nowlength < oldlength) {
      oldChildren.slice(order).forEach((child) => {
        diff.block.deleted.push({
          parentUids: [now.uid],
          ...child,
          deleted: true,
        });
      });
    }
  }
};

function diffSnapshotBlock(
  diff: Diff,
  parentUids: string[],
  now: SnapshotBlock,
  old: SnapshotBlock
) {
  const changeKeys = [
    "open",
    "string",
    "text-align",
    "heading",
    "view-type",
    "order",
  ] as (keyof DiffSnapshotBlock)[];
  changeKeys.forEach((key) => {
    if (!fieldEqual(key, now[key], old[key])) {
      let diffBlock: DiffBlockShotActually = (diff.block.changed[old.uid] = diff
        .block.changed[old.uid] || {
        uid: old.uid,
        order: old.order,
        parentUids,
        _now: now,
      });
      // @ts-ignore
      diffBlock[key] = {
        old: old[key],
        now: now[key],
      };
      if (key === "order") {
        diffBlock.orderChange = {
          old: old[key],
          now: now[key],
        };
      }
    }
  });
  const nowChildrenMap = (now.children || []).reduce((p, c) => {
    p[c.uid] = c;
    return p;
  }, {} as Record<string, SnapshotBlock>);

  const oldChildrenMap = (old.children || []).reduce((p, c) => {
    p[c.uid] = c;
    return p;
  }, {} as Record<string, SnapshotBlock>);
  // TODO: 不以 order 上是否相等为判断新增更新的标准.因为这样会让 只是 order 变化的 block 也被识别为 added 和 deleted
  keys(nowChildrenMap).forEach((key) => {
    if (oldChildrenMap[key]) {
      diffSnapshotBlock(
        diff,
        [...parentUids, now.uid],
        nowChildrenMap[key],
        oldChildrenMap[key]
      );
      delete nowChildrenMap[key];
      delete oldChildrenMap[key];
    }
  });
  keys(nowChildrenMap).forEach((key) => {
    diff.block.added.push({
      parentUids: [...parentUids, now.uid],
      ...nowChildrenMap[key],
      added: true,
    });
  });
  keys(oldChildrenMap).forEach((key) => {
    diff.block.deleted.push({
      parentUids: [...parentUids, now.uid],
      ...oldChildrenMap[key],
      deleted: true,
    });
  });
}

const getFieldWithDefault = (v: unknown, def: unknown) => {
  return v ?? def;
};

const getTextAlignWithDefault = (v?: unknown) => {
  return getFieldWithDefault(v, "left");
};

const getHeadingWithDefault = (v?: unknown) => {
  return getFieldWithDefault(v, v);
};

const getViewTypeWithDefault = (v?: unknown) => {
  return getFieldWithDefault(v, "bullet");
};

const fieldEqual = (field: string, v1: unknown, v2: unknown) => {
  if (field === "text-align") {
    return getTextAlignWithDefault(v1) === getTextAlignWithDefault(v2);
  }
  if (field === "heading") {
    return getHeadingWithDefault(v1) === getHeadingWithDefault(v2);
  }

  if (field === "view-type") {
    return getViewTypeWithDefault(v1) === getViewTypeWithDefault(v2);
  }

  return v1 === v2;
};
