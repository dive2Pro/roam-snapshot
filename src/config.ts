let API: RoamExtensionAPI;
export function initConfig(extensionAPI: RoamExtensionAPI) {
  API = extensionAPI;
}

export function getPageSnapshot(
  page: string
): { json: Snapshot; time: number }[] {
  const result = API.settings.get(page);
  if (!result) {
    return [];
  }
  try {
    return JSON.parse(result as string) as [];
  } catch (e) {
    return [];
  }
}
const keys = <T extends {}>(obj: T) => {
  return Object.keys(obj) as unknown as (keyof T)[];
};
const hasDifferenceWith = (a: SnapshotBlock, b: SnapshotBlock) => {
  const aKeys = keys(a);
  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i];
    if (key === "parents") {
      continue;
    }
    if (key === "children") {
      if (a[key].length !== b[key].length) {
        console.log("DIFF: ", key, a[key], b[key]);
        return true;
      }
      continue;
    }
    if (key === "time") {
      continue;
    }
    if (a[key] !== b[key]) {
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

const sortByOrder = (a: SnapshotBlock, b: SnapshotBlock) => a.order - b.order;
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

export function savePageSnapshot(pageUid: string, snapshot: Snapshot) {
  const old = getPageSnapshot(pageUid);
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
    }
  } else {
    sorted.unshift({
      json: snapshot,
      time: Date.now(),
    });
  }
  API.settings.set(pageUid, JSON.stringify(sorted));
}

export function diffSnapshot(pageUid: string, now: number, old: number) {
  const snapshots = getPageSnapshot(pageUid);
  if (!snapshots.length) {
    return undefined
  }
  if (old >= snapshots.length) {
    return snapshots[now]
  }
  const targetSnapshot = snapshots[old];
  const diff = {};
  diffSnapshots(diff, snapshots[now].json, targetSnapshot.json);
  console.log(diff);
  return snapshots[now];
}

type DiffSnapshotBlock = {
  open?: {
    old: boolean;
    now: boolean;
  };
  order: number;
  string?: {
    old: string;
    now: string;
  };
  uid: string;
  "text-align"?: {
    old: "center" | "left" | "right";
    now: "center" | "left" | "right";
  };
  heading?: {
    old: number;
    now: number;
  };
  "view-type"?: {
    old: "bullet" | "numbered" | "document";
    now: "bullet" | "numbered" | "document";
  };
  children?: DiffSnapshotBlock[];
};
type DiffSnapshot = {
  time: number;
  uid: string;
  title: {
    old: string;
    now: string;
  };
  children: DiffSnapshotBlock[];
};

type Diff = {
  title?: {
    old: string;
    now: string;
  };
  block?: {
    changed?: Record<string, DiffSnapshotBlock>;
    deleted?: (SnapshotBlock & { parentUids: string[] })[];
    added?: (SnapshotBlock & { parentUids: string[] })[];
  };
};

const diffSnapshots = (diff: Diff, now: Snapshot, old: Snapshot) => {
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
      })),
    };
  } else if (old.children.length && !now.children?.length) {
    diff.block = {
      deleted: old.children.map((child) => ({
        ...child,
        parentUids: [now.uid],
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
        });
      });
    } else if (nowlength < oldlength) {
      oldChildren.slice(order).forEach((child) => {
        diff.block.deleted.push({
          parentUids: [now.uid],
          ...child,
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
  if (now.uid !== old.uid) {
    diff.block.deleted.push({ ...old, parentUids });
    diff.block.added.push({ ...now, parentUids });
    return;
  }

  const changeKeys = [
    "open",
    "string",
    "text-align",
    "heading",
    "view-type",
  ] as (keyof DiffSnapshotBlock)[];
  changeKeys.forEach((key) => {
    if (now[key] !== old[key]) {
      let diffBlock: DiffSnapshotBlock = (diff.block.changed[old.uid] = diff
        .block.changed[old.uid] || {
        uid: old.uid,
        order: old.order,
      });
      // @ts-ignore
      diffBlock[key] = {
        old: old[key],
        now: now[key],
      };
    }
  });
  const nowChildren = (now.children || []).sort(sortByOrder);
  const oldChildren = (old.children || []).sort(sortByOrder);
  const nowlength = nowChildren.length;
  const oldlength = oldChildren.length;
  let order = 0;
  for (order = 0; order < Math.min(nowlength, oldlength); order++) {
    diffSnapshotBlock(
      diff,
      [...parentUids, now.uid],
      nowChildren[order],
      oldChildren[order]
    );
  }
  if (nowlength > oldlength) {
    nowChildren.slice(order).forEach((child) => {
      diff.block.added.push({
        parentUids: [now.uid],
        ...child,
      });
    });
  } else if (nowlength < oldlength) {
    oldChildren.slice(order).forEach((child) => {
      diff.block.deleted.push({
        parentUids: [now.uid],
        ...child,
      });
    });
  }
}
