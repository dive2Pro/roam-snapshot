import { Button, Menu, MenuItem } from "@blueprintjs/core";
import React, { useEffect, useState } from "react";
import { getPageSnapshot, savePageSnapshot } from "./config";
import { extension_helper } from "./helper";
import Dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
Dayjs.extend(relativeTime)
import "./style.less";

const getCurrentPageFromApi = async () => {
  const uid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  const pageTitle = window.roamAlphaAPI.q(
    `[:find ?e . :where [?b :block/uid "${uid}"] [?b :block/page ?p] [?p :node/title ?e]]`
  );

  if (pageTitle) {
    return pageTitle as unknown as string;
  }

  return window.roamAlphaAPI.q(
    `[:find ?e . :where [?b :block/uid "${uid}"]  [?b :node/title ?e]]`
  ) as unknown as string;
};

function PagePreview(props: { json: Snapshot }) {
  return <div>Hello</div>;
}
const timeFormat = (time: number) => {
  const fiveDaysInner = Dayjs(Date.now()).startOf('day').subtract(5, 'day');
  if (time >= fiveDaysInner.valueOf()) {
    return Dayjs(time).fromNow()
  }
  return Dayjs(time).format(`YYYY/MM/DD HH:mm`)
}
export default function Extension() {
  const [index, setIndex] = useState(0);
  const [list, setList] = useState<{ json: Snapshot; time: number }[]>([]);
  useEffect(() => {
    const mount = async () => {
      const pageTitle = await getCurrentPageFromApi();
      setList(getPageSnapshot(pageTitle).sort((a, b) => b.time - a.time));
    };
    mount();
  }, []);
  console.log(list, " = list");
  return (
    <div className="rm-snapshot">
      <div className="rm-snapshot-view">
        {list[index] ? <PagePreview json={list[index].json} /> : null}
      </div>
      <div className="rm-snapshot-list">
        <Menu className="rm-snapshot-list-view"  >
          {list.map((item, i) => {
            return (
              <MenuItem
                popoverProps={{
                  autoFocus: false
                }}
                active={index === i}
                key={item.time}
                onClick={() => setIndex(i)}
                className="rm-snapshot-list-view-item"
                text={timeFormat(item.time)}
              />
            );
          })}
        </Menu>
        <div className="rm-snapshot-list-footer">
          <Button text="Restore version" intent="primary" />
          <Button text="Cancel" />
        </div>
      </div>
    </div>
  );
}
type Info = {
  start: number;
  end: number;
  name: string;
};
const SNAP_SHOT_MAP = new Map<string, Info>();

const isExceed = (time: number) => {
  const now = Date.now();
  return now >= time;
};

const getFullPageJson = (pageTitle: string) => {
  return window.roamAlphaAPI.data.q(
    `[:find (pull ?b [
      :block/string 
      :node/title 
      :block/uid 
      :block/order 
      :block/heading 
      :block/open 
      :children/view-type
      :block/text-align
      :edit/time 
      :block/props
      :block/parents
      {:block/children ...}
    ]) . :where [?b :node/title "${pageTitle}"]]`
  ) as unknown as Snapshot;
};

const recordPage = (item: Info) => {
  // 先删除记录, 避免在记录页面快照时, 又有修改记录进来被误删.
  SNAP_SHOT_MAP.delete(item.name);
  //
  isRestoring = true;
  const json = getFullPageJson(item.name);
  savePageSnapshot(item.name, json);
  isRestoring = false;
};

const minute_1 = 1000 * 6;
const minute_10 = minute_1 * 10;
let isRestoring = false;
const startLoop = () => {
  // 每 60 秒检查一下是否有页面需要快照.
  const id = setInterval(() => {
    //TODO: 防止应用被关闭, 应用记录被打断, 将数据存到本地.

    SNAP_SHOT_MAP.forEach((item) => {
      console.log("test:", item);
      if (isExceed(item.end)) {
        recordPage(item);
      }
    });
  }, minute_1);
  extension_helper.on_uninstall(() => {
    clearInterval(id);
  });
};

/*
 *
 * Snapshots will be created every ten minutes.
 * Over the course of thirty minutes, you should expect to see three different versions in the page history.
 */
const triggerSnapshotRecordByPageTitle = (pageTitle: string) => {
  SNAP_SHOT_MAP.set(pageTitle, {
    start: Date.now(),
    end: Date.now() + minute_10,
    name: pageTitle,
  });
};

const getPageTitleFromDom = (el: HTMLElement) => {
  const targetEl = el.closest("[data-page-title]");
  return targetEl?.getAttribute("data-page-title");
};
function listenToChange() {
  const targetNode = document.getElementById("app");
  const config = { childList: true, subtree: true };
  const observer = new MutationObserver((mutationList, observer) => {
    for (const mutation of mutationList) {
      if (mutation.type === "childList" && !isRestoring) {
        const pageTitle = getPageTitleFromDom(mutation.target as HTMLElement);
        if (pageTitle) {
          triggerSnapshotRecordByPageTitle(pageTitle);
        }
      }
    }
  });

  // Start observing the target node for configured mutations
  observer.observe(targetNode, config);
  extension_helper.on_uninstall(() => {
    observer.disconnect();
  });
}

export function initExtension() {
  console.log("init extension");
  startLoop();
  listenToChange();
}
