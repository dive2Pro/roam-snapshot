

export const CONSTANTS = {
  PAGE_INTERVAL: "page-interval",
  BLOCK_INTERVAL: "block-interval",
  DB_STORE: "page-history",
  DB_PAGE_DELETED: "page-deleted",
  DB_BLOCK_STORE: "block-history",
  VERSION: "version",
  PAGE_UPLOAD_INTERVAL: "page-upload-interval"
};

export const getKey = (key: string) => {
  return isSnapshotKey(key) ? key : `rm-history-${key}`;
};

export const isSnapshotKey = (k: string) => {
  return k.startsWith(`rm-history-`);
};


