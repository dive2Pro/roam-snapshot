import { openDB } from "idb";
import { CONSTANTS } from "./CONSTANTS";

const dbPromise = openDB("rm-history", 1, {
  upgrade(db) {
    db.createObjectStore(CONSTANTS.DB_STORE);
  },
});

class DBOperator {
  async getAllData() {
    const db = await dbPromise;
    const allCacheKeys = await db.getAllKeys(CONSTANTS.DB_STORE);
    const allCacheData: [IDBValidKey, any][] = [];
    for await (const k of allCacheKeys) {
      allCacheData.push([k, await db.get(CONSTANTS.DB_STORE, k)]);
    }
    return allCacheData;
  }
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

  async hasRecord(key: string) {
    return !!(await (await dbPromise).get(CONSTANTS.DB_STORE, key));
  }
}
export const dbOperator = new DBOperator();
