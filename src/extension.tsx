import { Button, ButtonGroup, Menu, MenuItem, Icon } from "@blueprintjs/core";
import React, { useEffect, useRef, useState } from "react";
import { getPageSnapshot, savePageSnapshot } from "./config";
import { extension_helper } from "./helper";
import Dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
Dayjs.extend(calendar);
import "./style.less";

const getPageUidByPageTitle = (pageTitle: string) =>
  window.roamAlphaAPI.q(
    `[:find ?e . :where [?page :node/title "${pageTitle}"] [?page :block/uid ?e]]`
  ) as unknown as string;

const getCurrentPageFromApi = async () => {
  const uid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  const pageTitle = window.roamAlphaAPI.q(
    `[:find ?e . :where [?b :block/uid "${uid}"] [?b :block/page ?p] [?p :block/uid ?e]]`
  );

  if (pageTitle) {
    return pageTitle as unknown as string;
  }
  return uid;
};

function Block(props: {
  data: SnapshotBlock;
  level: number;
  viewType?: string;
}) {
  return (
    <div
      className={`roam-block-container rm-block rm-block--mine  rm-block--open rm-not-focused block-bullet-view ${
        props.data.heading ? `rm-heading-level-${props.data.heading}` : ""
      }`}
    >
      <div className="rm-block-main rm-block__self">
        <div className="controls rm-block__controls">
          <span className="block-expand">
            {props.data.open ? (
              <span className="bp3-icon-standard bp3-icon-caret-down rm-caret rm-caret-open rm-caret-hidden"></span>
            ) : (
              <span className="bp3-icon-standard bp3-icon-caret-down rm-caret rm-caret-closed rm-caret-showing" />
            )}
          </span>
          {(() => {
            if (props.viewType === "document") {
              return (
                <span
                  className={`rm-bullet   opacity-none ${
                    props.data.open ? "" : "rm-bullet--closed"
                  }
              `}
                >
                  <span className="rm-bullet__inner" />
                </span>
              );
            } else if (props.viewType === "numbered") {
              return (
                <span
                  className={`rm-bullet  rm-bullet--numbered rm-bullet--numbered-single-digit ${
                    props.data.open ? "" : "rm-bullet--closed"
                  }
              `}
                >
                  <span className="rm-bullet__inner--numbered" />
                </span>
              );
            }
            return (
              <span
                className={`rm-bullet ${
                  props.data.open ? "" : "rm-bullet--closed"
                }
              `}
              >
                <span className="rm-bullet__inner" />
              </span>
            );
          })()}
        </div>
        <div
          style={{
            textAlign: props.data["text-align"],
          }}
          className="rm-block__input rm-block__input--view roam-block dont-unfocus-block hoverparent rm-block-text"
        >
          {`${props.data.string}`}
        </div>
      </div>
      <div
        className={`rm-block-children rm-block__children rm-level-${props.level}`}
      >
        <div className="rm-multibar"></div>
        {props.data.children && props.data.open
          ? props.data.children
              .sort((a, b) => a.order - b.order)
              .map((child) => (
                <Block
                  viewType={props.data["view-type"]}
                  data={child}
                  level={props.level + 1}
                />
              ))
          : null}
      </div>
    </div>
  );
}

function PagePreview(props: { json?: Snapshot }) {
  return (
    <div className="rm-snapshot-view">
      {!props.json ? (
        <div className="rm-snapshot-view-empty">
          <Icon icon="outdated" size={30}></Icon>
          <div style={{ maxWidth: 340 }}>
            This page does not have any snapshots yet. Allow up to 10 minutes
            for the first snapshot to be generated.
          </div>
        </div>
      ) : (
        <div className="rm-article-wrapper rm-spacing--small">
          <div className="roam-article">
            <div>
              <div>
                <div className="rm-snapshot-view-title">
                  <h1 className="rm-title-display">
                    <span>{props.json?.title}</span>
                  </h1>
                </div>
                <div className="rm-block-children rm-block__children rm-level-0">
                  <div className="rm-multibar"></div>
                  {props.json?.children
                    .sort((a, b) => a.order - b.order)
                    .map((child) => {
                      return <Block data={child} level={1} />;
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const timeFormat = (time: number) => {
  return Dayjs(time).calendar(null, {
    sameDay: "[Today at] h:mm A", // The same day ( Today at 2:30 AM )
    lastDay: "[Yesterday at] h:mm A", // The day before ( Yesterday at 2:30 AM )
    sameElse: "YYYY/MM/DD HH:mm", // Everything else ( 17/10/2011 )
  });
};

const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Extension(props: { onChange: (b: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [list, setList] = useState<{ json: Snapshot; time: number }[]>([]);
  const [restoring, setRestoring] = useState(false);
  let pageUidRef = useRef("");
  useEffect(() => {
    const mount = async () => {
      const pageUid = await getCurrentPageFromApi();
      pageUidRef.current = pageUid;
      setList(getPageSnapshot(pageUid).sort((a, b) => b.time - a.time));
    };
    mount();
  }, []);
  const restore = async (json: Snapshot) => {
    setRestoring(true);
    await delay();
    restorePage(pageUidRef.current, json);
    setRestoring(false);
    await delay();
    props.onChange(false);
  };
  console.log(list, " = list");
  return (
    <div className="rm-snapshot">
      <PagePreview json={list[index]?.json} />
      <div className="rm-snapshot-list">
        <Menu className="rm-snapshot-list-view">
          {list.map((item, i) => {
            return (
              <MenuItem
                popoverProps={{
                  autoFocus: false,
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
          <ButtonGroup fill>
            <Button
              disabled={!list[index]}
              text="Restore version"
              intent="primary"
              loading={restoring}
              onClick={() => {
                restore(list[index].json);
              }}
            />
            <Button
              text="Cancel"
              onClick={() => {
                props.onChange(false);
              }}
            />
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
}
type Info = {
  start: number;
  end: number;
  uid: string;
};
const SNAP_SHOT_MAP = new Map<string, Info>();

const isExceed = (time: number) => {
  const now = Date.now();
  return now >= time;
};

const getFullPageJson = (uid: string) => {
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
    ]) . :where [?b :block/uid "${uid}"]]`
  ) as unknown as Snapshot;
};

const recordPage = (item: Info) => {
  // 先删除记录, 避免在记录页面快照时, 又有修改记录进来被误删.
  SNAP_SHOT_MAP.delete(item.uid);
  const json = getFullPageJson(item.uid);
  savePageSnapshot(item.uid, json);
};

const cleanPage = (pageUid: string) => {
  const firstLevelUids = (
    window.roamAlphaAPI.q(
      `[:find [(pull ?e [:block/uid]) ...] :where [?page :block/uid "${pageUid}"] [?page :block/children ?e]]`
    ) as unknown as { uid: string }[]
  )?.map((item) => item.uid);
  if (firstLevelUids) {
    firstLevelUids.forEach((uid) => {
      window.roamAlphaAPI.deleteBlock({
        block: {
          uid,
        },
      });
    });
  }
};
const restorePageByJson = async (json: Snapshot) => {
  await window.roamAlphaAPI.updatePage({
    page: {
      title: json.title,
      uid: json.uid,
    },
  });
  const restoreBlock = (parent: { uid: string }, block: SnapshotBlock) => {
    window.roamAlphaAPI.createBlock({
      location: {
        "parent-uid": parent.uid,
        order: block.order,
      },
      block: {
        ...block,
      },
    });
    if (block.children) {
      block.children.forEach((grandChild) => restoreBlock(block, grandChild));
    }
  };

  json.children.forEach((child) => {
    restoreBlock(json, child);
  });
};
const restorePage = (pageUid: string, json: Snapshot) => {
  isRestoring = true;
  // 暂停当前进行中的页面快照.
  cleanPage(pageUid);
  restorePageByJson(json);
  isRestoring = false;
};

const minute_1 = 1000 * 6;
const minute_10 = minute_1 * 3;
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
    console.log("Clean loop");
    clearInterval(id);
  });
};

/*
 *
 * Snapshots will be created every ten minutes.
 * Over the course of thirty minutes, you should expect to see three different versions in the page history.
 */
const triggerSnapshotRecordByPageUid = (uid: string) => {
  SNAP_SHOT_MAP.set(uid, {
    start: Date.now(),
    end: Date.now() + minute_10,
    uid,
  });
};

const getPageUidFromDom = async (el: HTMLElement) => {
  const targetEl = el.closest("[data-page-title]");
  const titleFromBlock = targetEl?.getAttribute("data-page-title");
  if (titleFromBlock) {
    const uid = getPageUidByPageTitle(titleFromBlock);
    return uid;
  }
  if (el.className === "rm-title-display") {
    return await getCurrentPageFromApi();
  }
};
const mutationTrigger = async (mutation: MutationRecord) => {
  const uid = await getPageUidFromDom(mutation.target as HTMLElement);
  // console.log(mutation.target, " --- ", uid);
  if (uid) {
    triggerSnapshotRecordByPageUid(uid);
  }
};

function listenToChange() {
  const targetNode = document.getElementById("app");
  const config = { childList: true, subtree: true };
  const observer = new MutationObserver((mutationList, observer) => {
    for (const mutation of mutationList) {
      if (mutation.type === "childList" && !isRestoring) {
        mutationTrigger(mutation);
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
