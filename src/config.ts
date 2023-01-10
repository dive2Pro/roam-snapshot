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
    if (key === 'parents') {
      continue
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
      console.log('DIFF: ', key, a[key], b[key])
      return true;
    }
  }
  if (b.children === undefined) {
    return false
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
