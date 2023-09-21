import { emitCacheChangeEvent } from "./event";
import { dbOperator } from "./dbOperator";
import { CONSTANTS } from "./CONSTANTS";
import { getKey } from "./CONSTANTS";
import { roamCacheUrl } from "./RoamCacheUrl";
import { keys } from "./helper";
import { cache } from "./cache";

export function hasUpgrade(v = 1) {
  return API.settings.get(CONSTANTS.VERSION) === v;
}

export function markHasUpgrade() {
  API.settings.set(CONSTANTS.VERSION, 1);
}

export let API: RoamExtensionAPI;
export async function initConfig(extensionAPI: RoamExtensionAPI) {
  API = extensionAPI;
  API.settings.panel.create({
    tabTitle: "Page History",
    settings: [
      {
        id: CONSTANTS.PAGE_INTERVAL,
        name: "Local Time Interval",
        description:
          "How long should you wait before taking a snapshot of a page after starting to edit it (The unit is minutes)",
        action: {
          type: "input",
          placeholder: "10",
        },
      },
      {
        id: CONSTANTS.PAGE_UPLOAD_INTERVAL,
        name: "Upload Interval",
        description:
          "How long before uploading the local cache to Roam Services? (The unit is minutes)",
        action: {
          type: "input",
          placeholder: "60",
        },
      },
    ],
  });
}

export function getIntervalTime() {
  return +API.settings.get(CONSTANTS.PAGE_INTERVAL) || 10;
}

export function getUploadIntervalTime() {
  return +API.settings.get(CONSTANTS.PAGE_UPLOAD_INTERVAL) || 60;
}

export async function saveToServer() {
  const oldUrl = roamCacheUrl.loadUrl()
  if (oldUrl) {
    await (window.roamAlphaAPI as unknown as RoamExtensionAPI).file.delete({
      url: oldUrl,
    });
    console.log(`deleted: ${oldUrl}`);
  }
  // 将所有的缓存都保存到服务器.
 const allCacheData = await dbOperator.getAllData();
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

async function saveToCache(key: string, value: any) {
  await cache.add(getKey(key), value);
  // 一旦有记录, 就记录到本地, 触发显示倒计时
  emitCacheChangeEvent(key);
}

async function getFromServer(key: string) {
  return cache.get(getKey(key));
}

export async function hasRecordInCache(key: string) {
  const r = await dbOperator.hasRecord(getKey(key));
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
