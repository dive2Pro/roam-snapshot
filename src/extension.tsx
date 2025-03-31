import {
  Button,
  ButtonGroup,
  Icon,
  Alert,
  Tree,
  TreeNodeInfo,
  Spinner,
  SpinnerSize,
  Divider,
} from "@blueprintjs/core";
import React, {
  FC,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  deletePageSnapshot,
  diffSnapshot,
  diffSnapshots,
  getIntervalTime,
  getPageSnapshotWithDiff,
  hasRecordInCache,
  savePageSnapshot,
  sortByOrder,
} from "./config";
import { keys } from "./helper";
import { extension_helper, minute_1 } from "./helper";
import Dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
Dayjs.extend(calendar);
import "./style.less";
import { diff } from "./diff-string";

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

const CONSTANTS = {
  css: {
    diff: {
      block: {
        add: "blob-addition",
        del: "blob-deletion",
      },
      content: {
        add: "diff-add",
        del: "diff-remove",
      },
    },
  },
};

const hasDiffInChildren = (block: SnapshotBlock, diff?: DiffBlock): boolean => {
  if (diff) {
    const result =
      diff.added.some((b) => b.parentUids.some((uid) => uid === block.uid)) ||
      diff.deleted.some((b) => b.parentUids.some((uid) => uid === block.uid)) ||
      keys(diff.changed).some((key) =>
        diff.changed[key].parentUids.some((uid) => uid === block.uid)
      );
    // console.log(result, "  ---- ", block, diff);
    return result || block.open;
  }
  return block.open;
};
function Block(props: {
  data: SnapshotBlock;
  level: number;
  viewType?: string;
  diff?: DiffBlock;
  parentUids: string[];
}) {
  const changed = props.diff ? props.diff.changed[props.data.uid] : undefined;
  const diffOpen = changed?.open;
  const diffViewType = changed?.["view-type"];
  const diffTextAlign = changed?.["text-align"];
  const diffHeading = changed?.heading;
  // console.log(props.data.order, " ---", props.data, diffOpen);

  const [state, setState] = useState({
    ...props.data,
    open: !!hasDiffInChildren(props.data, props.diff), // 当 有 diff 是子孙节点下, 默认打开
  });
  useEffect(() => {
    if (props.diff) {
      setState((prev) => ({
        ...prev,
        open: !!hasDiffInChildren(props.data, props.diff),
      }));
    }
  }, [props.diff]);
  const children = (() => {
    if (!state.open) {
      return null;
    }
    // console.log(
    //   props.data,
    //   props.parentUids,
    //   " = parent data",
    //   props.data.children,
    //   [props.parentUids, props.data.uid]
    // );
    const mappedChildren = getChildBlocks(
      props.diff,
      [...props.parentUids, props.data.uid],
      props.data.children || [],
      props.data
    );
    return mappedChildren.map((child, index) => {
      return (
        <Block
          viewType={props.data["view-type"]}
          data={{
            ...child,
            ...(props.data.added
              ? {
                  added: true,
                }
              : {}),
            ...(props.data.deleted
              ? {
                  deleted: true,
                }
              : {}),
          }}
          level={props.level + 1}
          diff={props.diff}
          parentUids={[...props.parentUids, props.data.uid]}
        />
      );
    });
  })();
  const open = state.open ?? true;
  let orderClazz;
  if (changed?.orderChange) {
    if (changed.orderChange.now < changed.orderChange.old) {
      orderClazz = (
        <Icon
          intent="success"
          className="rm-diff-order"
          icon="double-chevron-up"
          size={14}
        />
      );
    } else {
      orderClazz = (
        <Icon
          intent="danger"
          className="rm-diff-order"
          icon="double-chevron-down"
          size={14}
        />
      );
    }
  }
  return (
    <div
      className={`roam-block-container rm-block rm-block--mine  rm-block--open rm-not-focused block-bullet-view ${
        props.data.heading ? `rm-heading-level-${props.data.heading}` : ""
      } ${props.data.added ? CONSTANTS.css.diff.block.add : ""} ${
        props.data.deleted ? CONSTANTS.css.diff.block.del : ""
      }
        `}
    >
      {orderClazz}
      <div className="rm-block-main rm-block__self">
        <div className="controls rm-block__controls">
          <span className="block-expand">
            <DiffOpen
              diff={diffOpen}
              onChange={setState}
              clazz={` ${open ? "rm-caret-open" : "rm-caret-closed"} ${
                props.viewType === "document" && props.data.open
                  ? "rm-caret-showing"
                  : ""
              } ${diffOpen ? `diff-add` : ""} 
              ${open ? "bp3-icon-caret-down" : "bp3-icon-caret-down"}
                `}
              visible={
                (props.data.children || []).filter((child) => !child.deleted)
                  .length > 0
              }
            ></DiffOpen>
          </span>
          {(() => {
            const clazz = `${diffOpen ? CONSTANTS.css.diff.content.add : ""} 
            ${!open && state.children?.length ? "rm-bullet--closed" : ""}
            `;
            if (props.viewType === "document") {
              return (
                <span
                  className={`rm-bullet opacity-none 
              `}
                >
                  <span className="rm-bullet__inner" />
                </span>
              );
            } else if (props.viewType === "numbered") {
              return (
                <span
                  className={`rm-bullet  rm-bullet--numbered rm-bullet--numbered-single-digit ${clazz}
              `}
                >
                  <span
                    className={`rm-bullet__inner--numbered ${
                      diffViewType ? CONSTANTS.css.diff.content.add : ""
                    }`}
                  >
                    {props.data.order + 1}.
                  </span>
                </span>
              );
            }
            return (
              <span
                className={`rm-bullet ${clazz}
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
          className={`rm-block__input rm-block__input--view roam-block dont-unfocus-block hoverparent rm-block-text ${
            diffHeading || diffTextAlign ? CONSTANTS.css.diff.block.add : ""
          }`}
        >
          <PreviewTitle
            diff={(() => {
              if (props.diff) {
                if (
                  props.diff.changed[props.data.uid] &&
                  props.diff.changed[props.data.uid].string
                ) {
                  return props.diff.changed[props.data.uid].string;
                }
              }

              return undefined;
            })()}
          >
            <span
              className={`${
                props.data.added ? CONSTANTS.css.diff.content.add : ""
              }
              ${props.data.deleted ? CONSTANTS.css.diff.content.del : ""}
                `}
            >
              {props.data.string}
            </span>
          </PreviewTitle>
        </div>
      </div>
      <div
        className={`rm-block-children rm-block__children rm-level-${
          props.level
        } ${diffViewType ? CONSTANTS.css.diff.block.add : ""}`}
      >
        <div className="rm-multibar"></div>
        {children}
      </div>
    </div>
  );
}

function PagePreview(props: {
  data: Snapshot;
  index: number;
  uid: string;
  list: ITEM[];
}) {
  const [state, setState] = useState<{ diff?: Diff }>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (props.data) {
      const doAction = async () => {
        setLoading(true);
        setState({
          diff: await diffSnapshot(
            props.uid,
            props.list,
            props.index,
            props.index + 1
          ),
        });
        setLoading(false);
      };
      doAction();
    }
  }, [props.data, props.index]);
  // console.log(state, " --- state");
  return (
    <div className="rm-snapshot-view">
      {loading ? (
        <div className="flex-center">Loading...</div>
      ) : (
        <>
          {!props?.data ? (
            <div className="rm-snapshot-view-empty">
              <Icon icon="outdated" size={30}></Icon>
              <div style={{ maxWidth: 340 }}>
                This page does not have any snapshots yet. Allow up to{" "}
                {getIntervalTime()} minutes for the first snapshot to be
                generated.
              </div>
            </div>
          ) : (
            <div className="rm-article-wrapper rm-spacing--small">
              <div className="roam-article">
                <div>
                  <div>
                    <div className="rm-snapshot-view-title">
                      <h1 className="rm-title-display">
                        <PreviewTitle diff={state.diff?.title}>
                          {props.data.title}
                        </PreviewTitle>
                      </h1>
                    </div>
                    <div className="rm-block-children rm-block__children rm-level-0">
                      <div className="rm-multibar"></div>
                      {getChildBlocks(
                        state.diff?.block,
                        [props.uid],
                        props.data.children
                      ).map((child) => {
                        return (
                          <Block
                            diff={state.diff?.block}
                            data={child}
                            parentUids={[props.uid]}
                            level={1}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const getChildBlocks = (
  diff: DiffBlock = {},
  parentUids: string[],
  nowChildren: SnapshotBlock[],
  uid?: any
) => {
  const sorted = [...nowChildren.sort(sortByOrder)];
  const deleted = diff.deleted || [];
  const log = (...args: any) => {
    if (diff && sorted.length) {
      console.log(...args);
    }
  };

  const added = diff.added || [];
  if (added.length) {
    added
      .filter((addBlock) => {
        if (addBlock.parentUids.length !== parentUids.length) {
          return false;
        }
        return parentUids.every((uid, index, ary) => {
          return addBlock.parentUids[index] === uid;
        });
      })
      .forEach((addBlock) => {
        const index = sorted.findIndex((b) => {
          return b && b.uid === addBlock.uid;
        });
        // log(index," -----@@@" ,uid , " added", addBlock);
        console.log(
          index,
          sorted,
          "---@@@---",
          uid,
          "--@@@@-",
          addBlock,
          parentUids,
          diff
        );

        if (index > -1) {
          sorted.splice(index, 1, addBlock);
          // sorted[addBlock.order] = addBlock;
        }
        // console.log("addedblock, ", addBlock, parentUids);
        // console.log(sorted, added, " added ", nowChildren);
      });
  }
  if (deleted.length) {
    deleted
      .filter((delBlock) => {
        if (delBlock.parentUids.length !== parentUids.length) {
          return false;
        }
        return parentUids.every((uid, index) => {
          return delBlock.parentUids[index] === uid;
        });
      })
      .forEach((delBlock) => {
        sorted.splice(delBlock.order, 0, delBlock);
        log(delBlock, " del block", sorted);
      });
  }
  // log(sorted, diff, " ------- diff");

  return sorted;
};

const DiffOpen: FC<{
  diff?: { old: boolean; now: boolean };
  clazz: string;
  visible: boolean;
  onChange: any;
}> = (props) => {
  if (!props.visible) {
    return (
      <span className="bp3-icon-standard bp3-icon-caret-down rm-caret rm-caret-hidden" />
    );
  }
  return (
    <span
      onClick={() =>
        props.onChange((v: DiffSnapshotBlock) => ({ ...v, open: !v.open }))
      }
      className={`bp3-icon-standard  rm-caret rm-caret-toggle ${props.clazz}`}
    ></span>
  );
};
const DiffString: FC<{ diff: { old: string; now: string } }> = (props) => {
  const [diffResult, setDiffResult] = useState<ReturnType<typeof diff.diff>>();
  const [diffing, setDiffing] = useState(false);
  useEffect(() => {
    const process = async () => {
      setDiffing(true);
      await delay(100);
      const result = await diff.diff(props.diff.old, props.diff.now);

      setDiffResult(result);
      setDiffing(false);
    };
    process();

    // return JsDiff.diffString(props.diff.old, props.diff.now);
  }, [props.diff]);

  if (diffing || !diffResult) {
    return <div>Diffing...</div>;
  }
  console.log(diffResult.toString(), " string diff");

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: `${diffResult.toString().richText}`,
      }}
    >
      {diffResult.richText}
    </div>
  );
};

const PreviewTitle: FC<{ diff?: { old: string; now: string } }> = (props) => {
  if (props.diff) {
    return <DiffString diff={props.diff} />;
  } else {
    return <span>{props.children}</span>;
  }
};

const timeFormat = (time: number) => {
  return Dayjs(time).calendar(null, {
    sameDay: "[Today at] h:mm A", // The same day ( Today at 2:30 AM )
    lastDay: "[Yesterday at] HH:mm",
    lastWeek: "YYYY/MM/DD HH:mm", // Last week ( Last Monday at 2:30 AM )
    sameElse: "YYYY/MM/DD HH:mm", // Everything else ( 17/10/2011 )
  });
};

const dayFormat = (time: number) => {
  return Dayjs(time).calendar(null, {
    sameDay: "[Today]", // The same day ( Today at 2:30 AM )
    lastDay: "[Yesterday]",
    lastWeek: "YYYY/MM/DD", // Last week ( Last Monday at 2:30 AM )
    sameElse: "YYYY/MM/DD", // Everything else ( 17/10/2011 )
  });
};

const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Extension(props: { onChange: (b: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [list, setList] = useState<ITEM[]>([]);
  const [treeContents, setTreeContents] = useState<TreeNodeInfo<ITEM>[]>();
  const [restoring, setRestoring] = useState(false);
  const [isAlerting, setAlerting] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  let pageUidRef = useRef("");
  const group = (snapList: ITEM[]) => {
    const groupSnapListByDay = (list: ITEM[]) => {
      const result: Record<string, TreeNodeInfo<ITEM>> = {};
      list.forEach((item, index) => {
        const day = dayFormat(item.time);
        if (!result[day]) {
          result[day] = {
            childNodes: [],
            label: day,
            id: day,
            isExpanded: index === 0,
          };
        }
        result[day].childNodes.push({
          label: timeFormat(item.time),
          id: index,
          isSelected: index === 0,
        });
      });
      return Object.values(result);
    };
    console.log(snapList, " snapList");
    setTreeContents(groupSnapListByDay(snapList));
  };
  const mount = async () => {
    const pageUid = await getCurrentPageFromApi();
    pageUidRef.current = pageUid;
    setLoading(true);
    const snapList = (await getPageSnapshotWithDiff(pageUid)).sort(
      (a, b) => b.time - a.time
    );
    setList(snapList);
    setLoading(false);
    group(snapList);
  };
  useEffect(() => {
    mount();
  }, []);
  const restore = async (json: Snapshot) => {
    setRestoring(true);
    await delay(100);
    const diff: Diff = {};
    diffSnapshots(diff, json, getFullPageJson(pageUidRef.current));
    restorePageByDiff(json.uid, diff);
    setRestoring(false);
    setAlerting(false);
    await delay();
    props.onChange(false);
  };
  // console.log(list, " = list", treeContents);
  return (
    <div className="rm-snapshot">
      {isLoading ? (
        <div className="place-spinner">
          <Spinner size={SpinnerSize.LARGE} />
        </div>
      ) : null}
      <PagePreview
        uid={pageUidRef.current}
        data={list[index]?.json}
        index={index}
        key={list[index]?.time}
        list={list}
      />
      <div className="rm-snapshot-list">
        <div className="rm-snapshot-list-view">
          <Tree
            contents={treeContents}
            onNodeClick={(node: TreeNodeInfo, nodePath: NodePath) => {
              const originallySelected = node.isSelected;
              // console.log(originallySelected, ' node ', nodePath);

              if (!node.childNodes) {
                setIndex(node.id as number);
                setTreeContents((prev) => {
                  forEachNode(prev, (node) => (node.isSelected = false));
                  forNodeAtPath(prev, nodePath, (node) => {
                    node.isSelected =
                      originallySelected == null ? true : !originallySelected;
                  });
                  return [...prev];
                });
              } else {
                setTreeContents((prev) => {
                  forNodeAtPath(
                    prev,
                    nodePath,
                    (node) => (node.isExpanded = !node.isExpanded)
                  );
                  return [...prev];
                });
              }
            }}
            onNodeCollapse={(_node, nodePath) => {
              setTreeContents((prev) => {
                forNodeAtPath(
                  prev,
                  nodePath,
                  (node) => (node.isExpanded = false)
                );
                return [...prev];
              });
            }}
            onNodeExpand={(_node, nodePath) => {
              setTreeContents((prev) => {
                forNodeAtPath(
                  prev,
                  nodePath,
                  (node) => (node.isExpanded = true)
                );
                return [...prev];
              });
            }}
          />
        </div>

        <div className="rm-snapshot-list-footer">
          <ButtonGroup fill>
            <Button
              disabled={!list[index]}
              text="Restore version"
              active={false}
              intent="primary"
              onClick={() => {
                setAlerting(true);
              }}
            />
            <Button
              text="Delete"
              intent="danger"
              onClick={() => {
                setDeleting(true);
              }}
            />
          </ButtonGroup>
        </div>
      </div>
      <Alert
        cancelButtonText="Cancel"
        confirmButtonText="Continue"
        canEscapeKeyCancel
        canOutsideClickCancel
        intent="warning"
        isOpen={isAlerting}
        onConfirm={() => {
          restore(list[index].json);
        }}
        loading={restoring}
        onClose={(confirm) => !confirm && setAlerting(false)}
        icon="warning-sign"
      >
        <>
          <h4>Restoring blocks will override blocks on the page.</h4>
          The <strong>back references</strong> of the overridden blocks will no
          longer be valid and will be replaced by the text in the referenced
          blocks.
          <br />
          <p>Are you sure you want to continue?</p>
        </>
      </Alert>
      <Alert
        cancelButtonText="Close"
        confirmButtonText="Delete"
        canOutsideClickCancel
        canEscapeKeyCancel
        intent="danger"
        isOpen={isDeleting}
        onConfirm={async () => {
          console.log("___________________");
          setRestoring(true);
          // await delay(100)
          const result = await deletePageSnapshot(
            pageUidRef.current,
            list[index].time
          );
          setList(result);
          setIndex(0);
          group(result.sort((a, b) => b.time - a.time));
          setRestoring(false);
          setDeleting(false);
        }}
        icon="trash"
        loading={restoring}
        onClose={(confirm) => {
          if (!confirm) {
            setDeleting(false);
          }
        }}
      >
        <p>Are you sure you want to delete this record?</p>
      </Alert>
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

const recordPage = async (item: { uid: string }) => {
  // 先删除记录, 避免在记录页面快照时, 又有修改记录进来被误删.
  const json = getFullPageJson(item.uid);
  await savePageSnapshot(item.uid, json);
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

const restoreBlock = async (
  parent: { uid: string },
  block: SnapshotBlock,
  restored: Set<string>
) => {
  await window.roamAlphaAPI.deleteBlock({
    block,
  });
  try {
    if (!restored.has(block.uid)) {
      await window.roamAlphaAPI.createBlock({
        location: {
          "parent-uid": parent.uid,
          order: block.order,
        },
        block: {
          ...block,
          "children-view-type": block["view-type"],
        },
      });
      restored.add(block.uid);
    }
  } catch (e) {
    restored.add(block.uid);
    console.warn(e, parent, block, " _ ", restored);
  }

  if (block.children) {
    block.children.forEach((grandChild) =>
      restoreBlock(block, grandChild, restored)
    );
  }
};

const restorePageByJson = async (json: Snapshot) => {
  await window.roamAlphaAPI.updatePage({
    page: {
      title: json.title,
      uid: json.uid,
    },
  });

  json.children.forEach((child) => {
    restoreBlock(json, child, new Set());
  });
};
const restorePage = (pageUid: string, json: Snapshot) => {
  isRestoring = true;
  // 暂停当前进行中的页面快照.
  cleanPage(pageUid);
  restorePageByJson(json);
  isRestoring = false;
};

const restorePageByDiff = (pageUid: string, diff: Diff) => {
  isRestoring = true;
  console.log(diff, " = diff");
  // 暂停当前进行中的页面快照.
  if (diff.title) {
    window.roamAlphaAPI.updatePage({
      page: {
        title: diff.title.now,
        uid: pageUid,
      },
    });
  }
  if (diff.block) {
    if (diff.block.changed) {
      keys(diff.block.changed).forEach((key) => {
        const blockDiff = diff.block.changed[key]._now;
        window.roamAlphaAPI.updateBlock({
          block: {
            ...blockDiff,
            "children-view-type": blockDiff["view-type"],
          },
        });
      });
    }
    if (diff.block.added) {
      const createdBlocks = new Set<string>();
      diff.block.added
        .sort((a, b) => a.parentUids.length - b.parentUids.length)
        .forEach(async (block) => {
          restoreBlock(
            { uid: block.parentUids[block.parentUids.length - 1] },
            block,
            createdBlocks
          );
        });
    }
    if (diff.block.deleted) {
      // TODO 要找到最小的操作路径
      diff.block.deleted.forEach((block) => {
        window.roamAlphaAPI.deleteBlock({
          block,
        });
      });
    }
  }
  setTimeout(() => {
    isRestoring = false;
  }, 500);
};

let isRestoring = false;
const startLoop = () => {
  // 每 60 秒检查一下是否有页面需要快照.
  const id = setInterval(() => {
    SNAP_SHOT_MAP.forEach((item, key) => {
      // console.log("test:", item);
      if (isExceed(item.end)) {
        recordPage(item);
        SNAP_SHOT_MAP.delete(key);
      }
    });
  }, minute_1);
  extension_helper.on_uninstall(() => {
    console.log("Clean loop");
    clearInterval(id);
  });
};

const newRecordSet = new Set<string>();
const triggerSnapshotRecordByPageUid = async (uid: string) => {
  if (!SNAP_SHOT_MAP.has(uid))
    SNAP_SHOT_MAP.set(uid, {
      start: Date.now(),
      end: Date.now() + getIntervalTime() * minute_1,
      uid,
    });
  // console.log(await hasRecordInCache(uid), "---", uid);
  // 检查页面是否已有记录, 如果没有就先将当前的页面数据写入
  if (!(await hasRecordInCache(uid)) && !newRecordSet.has(uid)) {
    newRecordSet.add(uid);
    recordPage({ uid });
  }
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

const mutationAttributeTrigger = async (mutation: MutationRecord) => {
  if (mutation.attributeName === "class") {
    const uid = await getPageUidFromDom(mutation.target as HTMLElement);
    const target = mutation.target as HTMLElement;
    if (uid) {
      if (
        target.className.includes(
          "rm-block__input rm-block__input--view roam-block"
        ) ||
        target.className.includes("roam-block-container rm-block")
      ) {
        triggerSnapshotRecordByPageUid(uid);
      }
    }
  }
};

function simpleDebounce(fn: Function, delay = 500) {
  let timer = setTimeout(() => {}, delay);
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

const codeBlockTrigger = simpleDebounce(mutationTrigger);
const codeBlockAttributeTrigger = simpleDebounce(mutationAttributeTrigger);

function checkCodeBlocks(mutation: MutationRecord) {
  const el = mutation.target as HTMLElement;
  // 非代码块走普通逻辑
  // 但是代码块从 editing 变成 preview 也会走这条逻辑
  if (!el.closest(".rm-code-block") || !el.closest(".cm-editor")) {
    if (!el.closest(".roam-block")) {
      trigger();
      return true;
    }
    return false;
  }
  trigger();
  return true;
  function trigger() {
    if (mutation.type === "childList") {
      codeBlockTrigger(mutation);
    } else if (mutation.type === "attributes") {
      codeBlockAttributeTrigger(mutation);
    }
  }
}

function listenToChange() {
  const targetNode = document.querySelector(".roam-app");
  const config = { childList: true, subtree: true, attributes: true };
  const observer = new MutationObserver((mutationList, observer) => {
    for (const mutation of mutationList) {
      if (mutation.type === "childList" && !isRestoring) {
        if (checkCodeBlocks(mutation)) {
          return;
        }
        // console.log(mutation.target, mutation)
        mutationTrigger(mutation);
      } else if (mutation.type === "attributes") {
        if (checkCodeBlocks(mutation)) {
          return;
        }
        // console.log('attribute: ', (mutation.target as HTMLElement).closest(".rm-code-block"))
        mutationAttributeTrigger(mutation);
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
  startLoop();
  // initBottomOperators();
  listenToChange();
}

type NodePath = number[];
function forNodeAtPath(
  nodes: TreeNodeInfo[],
  path: NodePath,
  callback: (node: TreeNodeInfo) => void
) {
  callback(Tree.nodeFromPath(path, nodes));
}

function forEachNode(
  nodes: TreeNodeInfo[] | undefined,
  callback: (node: TreeNodeInfo) => void
) {
  if (nodes === undefined) {
    return;
  }

  for (const node of nodes) {
    callback(node);
    forEachNode(node.childNodes, callback);
  }
}

function Snapping() {
  const forceUpdate = useReducer((a) => a + 1, 0)[1];

  const content = [...SNAP_SHOT_MAP.entries()].map(([key, info]) => {
    return (
      <div>
        <div>
          {key}: {info.start} - {info.end}
        </div>
        <ButtonGroup>
          <Button
            small
            onClick={() => {
              SNAP_SHOT_MAP.delete(key);
              forceUpdate();
            }}
          >
            Remove
          </Button>
          <Divider />
          <Button
            small
            intent="primary"
            onClick={() => {
              SNAP_SHOT_MAP.delete(key);
              recordPage(info);
              forceUpdate();
            }}
          >
            Writing
          </Button>
        </ButtonGroup>
      </div>
    );
  });

  return <div>{content}</div>;
}


