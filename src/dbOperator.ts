import { openDB } from "idb";
import { CONSTANTS } from "./CONSTANTS";

const dbPromise = openDB("rm-history", 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(CONSTANTS.DB_STORE)) {
      db.createObjectStore(CONSTANTS.DB_STORE);
    }
    db.createObjectStore(CONSTANTS.DB_BLOCK_STORE);
    db.createObjectStore(CONSTANTS.DB_PAGE_DELETED);
  },
});

dbPromise.catch((err) => {
  console.error("Failed to open database:", err);
});

class DBOperator {
  constructor(public dbName: string) {}
  updateTimeKey = "updateTime";
  async update(k: string, value: any) {
    const r = await (await dbPromise).put(this.dbName, value, k);
    this.updateTime();

    return r;
  }

  async get(key: string) {
    return (await dbPromise).get(this.dbName, key);
  }

  private async updateTime() {
    await (await dbPromise).put(this.dbName, Date.now(), this.updateTimeKey);
  }

  async getUpdateTime() {
    return (await this.get(this.updateTimeKey)) || 0;
  }

  async replaceWith(data: [string, any][]) {
    console.log("DBOperator: replaceWith: ", data);
    const tx = (await dbPromise).transaction(this.dbName, "readwrite");
    await Promise.all(
      data.map((item) => {
        return tx.store.put(item[1], item[0]);
      })
    );
    await tx.done;
  }

  async hasRecord(key: string) {
    return !!(await (await dbPromise).get(this.dbName, key));
  }

  // 导出数据库中所有数据
  async exportData() {
    const db = await dbPromise;
    try {
      const tx = db.transaction(this.dbName, "readonly");
      const store = tx.objectStore(this.dbName);
      // 获取所有键值对
      const keys = await store.getAllKeys();
      const values = await store.getAll();

      // 构建导出数据
      const exportData = {
        storeName: this.dbName,
        data: keys.map((key, index) => ({
          key: key,
          value: values[index],
        })),
      };

      return exportData;
    } catch (e) {
      console.error("DBOperator: exportData: ", e);
      return {
        storeName: this.dbName,
        data: [],
      };
    }
  }

  // 从备份数据恢复
  async importData(backupData: {
    storeName: string;
    data: Array<{ key: IDBValidKey; value: any }>;
  }) {
    // 验证数据是否匹配当前存储
    if (backupData.storeName !== this.dbName) {
      return;
    }

    const db = await dbPromise;
    const tx = db.transaction(this.dbName, "readwrite");
    const store = tx.objectStore(this.dbName);

    // 清除现有数据
    await store.clear();

    // 导入新数据
    for (const item of backupData.data) {
      await store.put(item.value, item.key);
    }

    await tx.done;
    await this.updateTime();
  }
}

export const dbOperator = new DBOperator(CONSTANTS.DB_STORE);
export const blockDBOperator = new DBOperator(CONSTANTS.DB_BLOCK_STORE);
export const dbPageDeletedOpetator = new DBOperator(CONSTANTS.DB_PAGE_DELETED);

export const dbCache = {
  exportAllData() {
    return Promise.all([
      dbOperator.exportData(),
      blockDBOperator.exportData(),
      dbPageDeletedOpetator.exportData(),
    ]);
  },

  importAllData(
    data: { storeName: string; data: { key: IDBValidKey; value: any }[] }[]
  ) {
    return Promise.all([
      data.map((item) => {
        return dbOperator.importData({
          storeName: item.storeName,
          data: item.data,
        });
      }),
    ]);
  },
};
