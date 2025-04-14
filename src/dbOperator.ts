import { openDB } from "idb";
import { CONSTANTS } from "./CONSTANTS";

const dbPromise = openDB("rm-history", 2, {
  upgrade(db) {
    if(!db.objectStoreNames.contains(CONSTANTS.DB_STORE)) {
      db.createObjectStore(CONSTANTS.DB_STORE);
    }
    db.createObjectStore(CONSTANTS.DB_BLOCK_STORE);
    db.createObjectStore(CONSTANTS.DB_PAGE_DELETED);
  },
});

dbPromise.catch((err) => {
  console.error("Failed to open database:", err);
})

class DBOperator {
  constructor(public dbName = CONSTANTS.DB_STORE) {
  }
  updateTimeKey = "updateTime";
  async update(k: string, value: any) {
    const r = await(await dbPromise).put(this.dbName, value, k);
    this.updateTime();

    return r;
  }

  async get(key: string) {
    return (await dbPromise).get(this.dbName, key);
  }

  private async updateTime() {
    await (
      await dbPromise
    ).put(this.dbName, Date.now(), this.updateTimeKey);
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
}
 

export const dbOperator = new DBOperator();
export const blockDBOperator = new DBOperator(CONSTANTS.DB_BLOCK_STORE);
export const dbPageDeletedOpetator = new DBOperator(CONSTANTS.DB_PAGE_DELETED);