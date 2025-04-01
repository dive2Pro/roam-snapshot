import { dbOperator } from "./dbOperator";
import { CONSTANTS } from "./CONSTANTS";
import { getKey } from "./CONSTANTS";
import { deepClone, keys } from "./helper";
import { cache } from "./cache";
import * as jsondiffpatch from "jsondiffpatch";

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
        name: "Page Snapshot Interval",
        description: "Minutes between automatic page snapshots after editing",
        action: {
          type: "input",
          placeholder: "10",
        },
      },
      {
        id: CONSTANTS.BLOCK_INTERVAL,
        name: "Block Snapshot Interval",
        description: "Minutes between automatic block snapshots after editing",
        action: {
          type: "input",
          placeholder: "5",
        },
      },
    ],
  });
}

export function getIntervalTime() {
  return +API.settings.get(CONSTANTS.PAGE_INTERVAL) || 10;
}
export function getBlockIntervalTime() {
  return +API.settings.get(CONSTANTS.BLOCK_INTERVAL) || 5;
}
export function getUploadIntervalTime() {
  return +API.settings.get(CONSTANTS.PAGE_UPLOAD_INTERVAL) || 60;
}

async function saveToCache(key: string, value: any) {
  await cache.add(getKey(key), value);
  // 一旦有记录, 就记录到本地, 触发显示倒计时
}

async function getFromServer(key: string) {
  return cache.get(getKey(key));
}

export async function hasRecordInCache(key: string) {
  const r = await dbOperator.hasRecord(getKey(key));
  return !!r;
}

export async function getPageSnapshot(page: string): Promise<ITEM[]> {
  try {
    console.time("LOADING");
    const result = await getFromServer(page);
    // console.log(result, " --- result --- ", getKey(page));
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

export async function getPageSnapshotWithDiff(page: string): Promise<ITEM[]> {
  try {
    console.time("LOADING");
    let result = await getFromServer(page);
    // console.log(result, " --- result --- ", getKey(page));
    if (!result) {
      // 不能写空, 有可能 result = undefined 是因为数据请求为空
      // API.settings.set(getKey(page), undefined);
      return [];
    }

    result.reverse().forEach((item, index, arr) => {
      if (item.json) {
        return;
      }
      if (item.diff) {
        item.json = jsondiffpatch.patch(
          deepClone(arr[index - 1].json),
          item.diff
        );
      }
    });
    console.log("result = ==== ", result);
    return result.reverse();
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

export async function saveBlockSnapshot(blockUid: string, content: string) {
  const oldblockCache = (await cache.getBlock(blockUid)) || [];
  if (oldblockCache.length) {
    const lastBlock = oldblockCache[0];
    if (lastBlock.string === content) {
      return;
    }
  }

  const newCache = [
    {
      string: content,
      time: Date.now(),
    },
    ...oldblockCache,
  ];
  console.log("newCache = ", blockUid ,newCache)
  cache.addBlock(blockUid, newCache);
}
export async function savePageSnapshot(pageUid: string, snapshot: Snapshot) {
  const old = await getPageSnapshot(pageUid);

  // 两个最近的 json 之间有差异, 才插入;
  const sorted = old
    .sort((a, b) => {
      return b.time - a.time;
    })
    .filter((a) => !a.diff || Object.keys(a.diff || {}).length !== 0);
  console.log(`sorted`, sorted);
  // 插入到前面
  if (sorted.length) {
    const jsonDiff = jsondiffpatch
      .create()
      .diff(latestSnapshot(sorted), snapshot);
    if (jsonDiff) {
      sorted.unshift({
        time: Date.now(),
        diff: jsonDiff,
        title: snapshot.title,
      });
    } else {
      return;
    }
  } else {
    // 新入
    sorted.unshift({
      json: snapshot,
      time: Date.now(),
      title: snapshot.title,
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
  snapshots: ITEM[],
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
  return diff;
}

export const diffSnapshots = (diff: Diff, now: Snapshot, old: Snapshot) => {
  if (now.title !== old.title) {
    diff.title = {
      old: old.title,
      now: now.title,
    };
  }
  console.log(`DIFF: `, now, old);
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

    const nowChildrenMap = (now.children || []).reduce((p, c) => {
      p[c.uid] = c;
      return p;
    }, {} as Record<string, SnapshotBlock>);

    const oldChildrenMap = (old.children || []).reduce((p, c) => {
      p[c.uid] = c;
      return p;
    }, {} as Record<string, SnapshotBlock>);
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

function latestSnapshot(sorted: ITEM[]) {
  const diffEnd = sorted.findIndex((v) => v.json) - 1;

  const originDiff = sorted[diffEnd + 1].json;
  let result = originDiff;
  for (let i = 0; i <= diffEnd; i++) {
    jsondiffpatch.patch(deepClone(result), sorted[i].diff);
  }
  return result;
}
