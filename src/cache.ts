import { blockDBOperator, dbOperator } from "./dbOperator";
import { getKey } from "./CONSTANTS";

class LocalCache {
  async add(key: string, value: any) {
    const r = dbOperator.update(key, value);
    return r.toString();
  }
  async get(key: string) {
    // 兼容 v1 , 如果本地没有,
    // console.log(key, " ---");
    return dbOperator.get(getKey(key)) as Promise<ITEM[]>;
  }

  async getBlock(key: string) {
    // console.log(key, " ---");
    return blockDBOperator.get(key) as Promise<Block_SNAP[]>;
  }

  async addBlock(key: string, value: any) {
    const r = blockDBOperator.update(key, value);
    return r.toString();
  }
}

export const cache = new LocalCache();
