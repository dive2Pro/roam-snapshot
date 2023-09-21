

export const CONSTANTS = {
  PAGE_INTERVAL: "page-interval",
  DB_STORE: "page-history",
  VERSION: "version",
};export const getKey = (key: string) => {
  return isSnapshotKey(key) ? key : `rm-history-${key}`;
};

export const isSnapshotKey = (k: string) => {
  return k.startsWith(`rm-history-`);
};

