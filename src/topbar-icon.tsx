import {
  Button,
  Card,
  Classes,
  Dialog,
  Icon,
  MenuItem,
  Position,
  Tooltip,
} from "@blueprintjs/core";
import { useEffect, useState } from "react";
import ReactDom from "react-dom";
import Extension from "./extension";
import "arrive";

import { extension_helper } from "./helper";
import { cache } from "./cache";
import React from "react";
import HorizontalSteps from "./comps/steps";
import { DiffString } from "./comps/DiffString";

function TopbarIcon() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a
        className="bp3-menu-item"
        onClick={() => {
          setOpen((prev) => !prev);
        }}
      >
        <Icon icon="history" size={14} color="#8A9BA8" />
        <span className="bp3-fill bp3-text-overflow-ellipsis">
          Page History
        </span>
      </a>
      <Dialog
        onClose={() => setOpen((prev) => !prev)}
        isOpen={open}
        style={{ width: "unset", paddingBottom: 0 }}
      >
        <Extension onChange={setOpen} />
      </Dialog>
    </>
  );
}

export function initTopbarIcon(extensionAPI: RoamExtensionAPI) {
  const onArrive = (t: HTMLElement) => {
    const parent = t.parentElement.parentElement.parentElement;
    const el = document.createElement("li");
    parent.insertBefore(el, t.closest("li"));
    ReactDom.render(<TopbarIcon />, el);
  };
  const selector = `.rm-topbar .bp3-menu .bp3-icon-export`;
  document.arrive(selector, onArrive);
  const el = document.createElement("div");
  document.body.appendChild(el);
  ReactDom.render(<BlockHistory />, el);
  extension_helper.on_uninstall(() => {
    document.unbindArrive(selector, onArrive);
    el.remove();
  });
}

function BlockHistory() {
  const [open, setOpen] = useState(false);
  // 修改 timelinePoints 的实现方式
  const [snapshots, setSnapshots] = useState([]);

  useEffect(() => {
    const label = "Block Snapshots";
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label,
      // @ts-ignore
      "display-conditional": (e) => {
        return !!cache.getBlock(e["block-uid"]);
      },
      callback: async (e) => {
        const readBlockHistories = async () => {
          const blockHistories = await cache.getBlock(e["block-uid"]);
          if (!blockHistories) {
            // 写入缓存
            await cache.addBlock(e["block-uid"], [
              {
                string: e["block-string"],
                time: Date.now(),
              },
            ]);
            readBlockHistories();
            return;
          }
          // 将历史数据转换为快照数组
          setSnapshots(
            blockHistories.reverse().map((block, index) => {
              return {
                ...block,
                active: index === (blockHistories.length - 1),
              };
            })
          );
        };
        readBlockHistories();
        setOpen(true);
      },
    });
    return () => {
      window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
        label,
      });
    };
  }, []);
  
  const lastestString = snapshots[snapshots.length - 1]?.string;
  const nowString = snapshots.find((s) => s.active)?.string;
  console.log(nowString, lastestString);
  return (
    <Dialog
      title="Block Snapshots"
      isOpen={open}
      className="rm-snapshot-block"
      onClose={() => setOpen(false)}
      style={{
        width: 650,
      }}
    >
      <div className={Classes.DIALOG_BODY}>
        <Card elevation={1}>
          <DiffString
            diff={{
              now: nowString,
              old: lastestString,
            }}
          />
        </Card>
        <div
          className="timeline-container"
          style={{ position: "relative", marginTop: 20 }}
        >
          <div
            className="timeline-line"
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: "#E1E8ED",
            }}
          ></div>
          <div
            className="flex"
            style={{
              justifyContent: snapshots.length > 1 ? "space-between" : "center",
              display: "flex",
            }}
          >
            {snapshots.map((point, index) => {
              return (
                <Tooltip>
                  <div
                    className={`timeline-point ${point.active ? "active" : ""}`}
                    onClick={() => {
                      setSnapshots((prev) =>
                        prev.map((s, i) => ({ ...s, active: i === index }))
                      );
                    }}
                  />
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div
          className={Classes.DIALOG_FOOTER_ACTIONS}
          style={{
            alignItems: "center",
            gap: 20,
          }}
        >
          <div className="metadata-section">
            <span className={Classes.TEXT_MUTED}>
              时间： 2021/10/22 傍晚 17:48
            </span>
          </div>

          {/* Playback Controls */}
          <div className="playback-controls" style={{ flex: 1 }}>
            {/* Note: Using step-backward for the first icon */}
            <Button
              minimal={true}
              icon={"step-backward"}
              aria-label="Jump to earliest"
            />
            <Button
              minimal={true}
              icon={"fast-backward"}
              aria-label="Previous version"
            />
            {/* Large Play Button */}
            <Button
              className="play-button-large"
              icon={"play"}
              aria-label="Play history"
            />
            <Button
              minimal={true}
              icon={"fast-forward"}
              aria-label="Next version"
            />
            <Button
              minimal={true}
              icon={"step-forward"}
              aria-label="Jump to latest"
            />
          </div>

          {/* Action Button */}
          <div className="action-button-section">
            <Button
              intent={"danger"} // Or use custom class for specific red
              text="恢复此版本"
              // className="restore-button-custom-red" // Example if using custom CSS for color
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
