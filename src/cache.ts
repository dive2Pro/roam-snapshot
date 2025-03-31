import { dbOperator } from "./dbOperator";
import { getKey } from "./CONSTANTS";

class LocalCache {
  async add(key: string, value: any) {
    const r = dbOperator.update(key, value);
    return r.toString();
  }
  async get(key: string) {
    // 兼容 v1 , 如果本地没有,
    console.log(key, " ---");
    return dbOperator.get(getKey(key)) as Promise<ITEM[]>;
  }
}

export const cache = new LocalCache();
