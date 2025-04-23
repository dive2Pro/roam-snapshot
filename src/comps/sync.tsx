import {
  Button,
  Card,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Switch,
} from "@blueprintjs/core";
import { useEffect, useState } from "react";
import { CONSTANTS } from "../CONSTANTS";
import { dbCache } from "../dbOperator";
import {
  emitBackupFinishEvent,
  emitBackupStartEvent,
  onBackupFinishEvent,
  onBackupStartEvent,
} from "../event";

const INTERVAL_WEEK = 1000 * 3600 * 24 * 7;
const INTERVAL_DAY = 1000 * 3600 * 24;
const INTERVAL_HOUR = 1000 * 3600;
let isBackup = false;
let extensionAPI: RoamExtensionAPI;
export function checkItsTimeToBackup() {
  if (utils.getLastestBackupTime() <= 0) {
    return;
  }
  if (Date.now() < utils.getLastestBackupTime()) {
    return;
  }

  backup()
    .then(() => {
      utils.updateLastestBackupTime(Date.now());
    })
    .finally(() => {});
}

async function backup() {
  if (isBackup) {
    throw new Error("is backuping");
  }
  isBackup = true;
  emitBackupStartEvent();
  const oldUrl = extensionAPI.settings.get(CONSTANTS.SYNC_BACKUP_FILE_URL);
  // 合并新旧数据
  async function mergeData(
    localData: {
      storeName: string;
      data: {
        key: IDBValidKey;
        value: {
          time: number;
        }[];
      }[];
    }[]
  ) {
    if (oldUrl) {
      const oldData = await (
        window.roamAlphaAPI as unknown as RoamExtensionAPI
      ).file.get({
        url: oldUrl,
      });
      if (!oldData) {
        return localData;
      }

      try {
        const oldDataJson = JSON.parse(await oldData.text()) as {
          storeName: string;
          data: {
            key: IDBValidKey;
            value: {
              time: number;
            }[];
          }[];
        }[];

        const result = [];
        for (const oldData of oldDataJson) {
          const mergedMap = new Map<string, { time: number }[]>();
          const newData = localData.find(
            (item) => item.storeName === oldData.storeName
          );
          oldData.data.forEach((oldItem) => {
            mergedMap.set(oldItem.key as string, oldItem.value);
          });
          newData.data.forEach((newItem) => {
            const timeSet = new Set<number>();
            if (!mergedMap.has(newItem.key as string)) {
              mergedMap.set(newItem.key as string, newItem.value);
            } else {
              const oldItemData = mergedMap.get(newItem.key as string);
              oldItemData.forEach((item) => {
                timeSet.add(item.time);
              });
              newItem.value.forEach((item) => {
                if (!timeSet.has(item.time)) {
                  oldItemData.push(item);
                }
              });
              mergedMap.set(newItem.key as string, oldItemData);
            }
          });
          result.push({
            storeName: oldData.storeName,
            data: Array.from(mergedMap.entries()).map(([key, value]) => {
              return {
                key,
                value,
              };
            }),
          });
        }
        return result;
      } catch (e) {
        console.error(e);
      }
    }

    return localData;
  }
  return dbCache
    .exportAllData()
    .then(async (localData) => {
      console.log(localData, " = export all data");
      let data = await mergeData(localData);
      dbCache.importAllData(data);

      const url = await (
        window.roamAlphaAPI as unknown as RoamExtensionAPI
      ).file.upload({
        file: new File([JSON.stringify(data)], `roam-history.json`, {
          type: "application/json",
        }),
        toast: { hide: true },
      });
      console.log({
        url,
        oldUrl,
      });
      extensionAPI.settings.set(CONSTANTS.SYNC_BACKUP_FILE_URL, url);
      if (oldUrl && url) {
        await (window.roamAlphaAPI as unknown as RoamExtensionAPI).file.delete({
          url: oldUrl,
        });
        console.log(`deleted: ${oldUrl}`);
      }
    })
    .finally(() => {
      isBackup = false;
      emitBackupFinishEvent();
    });
}

const utils = {
  updateLastestBackupTime: (time: number) => {
    extensionAPI.settings.set(CONSTANTS.SYNC_LASTEST_TIME, time);
  },
  getBackupInterval: () => {
    return (extensionAPI.settings.get(CONSTANTS.SYNC_INTERVAL) as number) || 0;
  },
  getLastestBackupTime: () => {
    const interval =
      (extensionAPI.settings.get(CONSTANTS.SYNC_INTERVAL) as number) || 0;
    if (interval <= 0) {
      return -1;
    }
    const lastestBackupTime =
      (extensionAPI.settings.get(CONSTANTS.SYNC_LASTEST_TIME) as number) || 0;
    if (!lastestBackupTime) {
      return Date.now() + interval;
    } else {
      return lastestBackupTime + interval;
    }
  },
};

export function createSync(_extensionAPI: RoamExtensionAPI) {
  extensionAPI = _extensionAPI;
  return function Sync() {
    const [syncInterval, setSyncInterval] = useState(() =>
      utils.getBackupInterval()
    );
    const [isBackup, setIsBackup] = useState(false);
    const updateInterval = (interval: number) => {
      setSyncInterval(interval);
      extensionAPI.settings.set(CONSTANTS.SYNC_INTERVAL, interval);
    };
    useEffect(() => {
      const offStartEvent = onBackupStartEvent(() => {
        setIsBackup(true);
      });
      const offFinishEvent = onBackupFinishEvent(() => {
        setIsBackup(false);
      });
      return () => {
        offStartEvent();
        offFinishEvent();
      };
    }, []);
    const isSyncEnabled = utils.getBackupInterval() > 0;
    const label = (() => {
      if (syncInterval === INTERVAL_WEEK) {
        return "Sync with server every week"; // 修改描述
      }
      if (syncInterval === INTERVAL_DAY) {
        return "Sync with server every day"; // 修改描述
      }
      if (syncInterval === INTERVAL_HOUR) {
        return "Sync with server every hour"; // 修改描述
      }
      return "Disabled";
    })();

    console.log({
      isBackup,
    });
    return (
      <div
        style={{
          width: "100%",
        }}
      >
        <MenuDivider />
        <div className="flex-column gap-2">
          <h3>
            <strong>Auto Sync</strong> {/* 修改标题 */}
          </h3>
          <div className="flex-menu-item">
            <Popover
              position="bottom"
              content={
                <Menu>
                  <MenuItem
                    onClick={() => {
                      updateInterval(0);
                    }}
                    text="Disabled"
                  ></MenuItem>
                  <MenuItem
                    onClick={() => {
                      updateInterval(INTERVAL_WEEK);
                    }}
                    text="Sync with server every week" // 修改描述
                  ></MenuItem>

                  <MenuItem
                    onClick={() => {
                      updateInterval(INTERVAL_DAY);
                    }}
                    text="Sync with server every day" // 修改描述
                  ></MenuItem>
                  <MenuItem
                    onClick={() => {
                      updateInterval(INTERVAL_HOUR);
                    }}
                    text="Sync with server every hour" // 修改描述
                  ></MenuItem>
                </Menu>
              }
            >
              <Button icon="time" rightIcon="caret-down">
                {label}
              </Button>
            </Popover>
          </div>
          {isSyncEnabled && (
            <>
              <div>
                <Button
                  disabled={!isSyncEnabled}
                  icon="refresh" // 修改图标为 sync/refresh 更合适
                  loading={isBackup}
                  onClick={() => {
                    backup();
                  }}
                >
                  Sync Now {/* 修改按钮文本 */}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };
}
