

export const CONSTANTS = {
  PAGE_INTERVAL: "page-interval",
  BLOCK_INTERVAL: "block-interval",
  DB_STORE: "page-history",
  DB_PAGE_DELETED: "page-deleted",
  DB_BLOCK_STORE: "block-history",
  VERSION: "version",
  PAGE_UPLOAD_INTERVAL: "page-upload-interval",
  SYNC: "data-sync",
  SYNC_INTERVAL: "data-sync-interval",
  SYNC_LASTEST_TIME: "data-sync-lastest-time",
  SYNC_BACKUP_FILE_URL: "data-sync-backup-file-url",
};

export const getKey = (key: string) => {
  return isSnapshotKey(key) ? key : `rm-history-${key}`;
};

export const isSnapshotKey = (k: string) => {
  return k.startsWith(`rm-history-`);
};


