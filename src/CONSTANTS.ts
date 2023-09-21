

export const CONSTANTS = {
  PAGE_INTERVAL: "page-interval",
  DB_STORE: "page-history",
  VERSION: "version",
  PAGE_UPLOAD_INTERVAL: "page-upload-interval"
};export const getKey = (key: string) => {
  return isSnapshotKey(key) ? key : `rm-history-${key}`;
};

export const isSnapshotKey = (k: string) => {
  return k.startsWith(`rm-history-`);
};

