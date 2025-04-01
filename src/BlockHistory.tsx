import {
  Classes,
  Dialog,
  Card,
  Tooltip,
  Position,
  Button,
} from "@blueprintjs/core";
import dayjs from "dayjs";
import React, { useState, useEffect, useRef } from "react";
import { cache } from "./cache";
import { DiffString } from "./comps/DiffString";
import { saveBlockSnapshot } from "./config";

export function BlockHistory() {
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // 修改 timelinePoints 的实现方式
  const [snapshots, setSnapshots] = useState([]);
  const [activeSnapShotIndex, setActiveSnapshotIndex] = useState(0);
  let uidRef = useRef("")
  useEffect(() => {
    const label = "History: Block Timeline";
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label,
      // @ts-ignore
      "display-conditional": (e) => {
        return !!cache.getBlock(e["block-uid"]);
      },
      callback: async (e) => {
        const readBlockHistories = async () => {
          const blockHistories = await cache.getBlock(e["block-uid"]);
          uidRef.current = e["block-uid"];
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
          setSnapshots(blockHistories.reverse());
          setActiveSnapshotIndex(blockHistories.length - 1);
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
  const activeSnapShot = snapshots[activeSnapShotIndex];
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = React.useRef(null);

  useEffect(() => {
    document.querySelector(".timeline-point.active")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeSnapShotIndex]);
  const stopPlaying = () => {
    clearInterval(playIntervalRef.current);
    playIntervalRef.current = null;
    setIsPlaying(false);
  };
  return (
    <Dialog
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
              now: activeSnapShot?.string,
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
            className="timeline-steps"
            style={{
              justifyContent:
                snapshots.length > 1
                  ? "space-between"
                  : snapshots.length > 8
                  ? "flex-start"
                  : "center",
              gap: snapshots.length > 8 ? 82 : 0,
            }}
          >
            {snapshots.map((point, index) => {
              return (
                <Tooltip
                  content={`${dayjs(point.time).format("YYYY/MM/DD HH:mm")}`}
                >
                  <div
                    className={`timeline-point ${
                      index === activeSnapShotIndex ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveSnapshotIndex(index);
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
              Time：{dayjs(activeSnapShot?.time).format("YYYY/MM/DD HH:mm")}
            </span>
          </div>

          {/* Playback Controls */}
          <div className="playback-controls" style={{ flex: 1 }}>
            {/* Note: Using step-backward for the first icon */}
            <Button
              minimal={true}
              icon={"step-backward"}
              disabled={activeSnapShotIndex <= 0}
              onClick={() => {
                stopPlaying();
                setActiveSnapshotIndex(0);
              }}
              aria-label="Jump to earliest"
            />
            <Button
              minimal={true}
              icon={"fast-backward"}
              disabled={activeSnapShotIndex <= 0}
              onClick={() => {
                stopPlaying();

                setActiveSnapshotIndex(activeSnapShotIndex - 1);
              }}
              aria-label="Previous version"
            />
            <Button
              className="play-button-large"
              large
              icon={isPlaying ? "pause" : "play"}
              aria-label="Play history"
              onClick={() => {
                // Implement the logic for playing the history
                // Implement the logic for playing the history
                if (isPlaying) {
                  // Stop playing
                  clearInterval(playIntervalRef.current);
                  playIntervalRef.current = null;
                  setIsPlaying(false);
                } else {
                  // Start playing
                  setIsPlaying(true);

                  // Set interval to move through snapshots
                  playIntervalRef.current = setInterval(() => {
                    setActiveSnapshotIndex((prevIndex) => {
                      // If we're at the end, go back to the beginning
                      if (prevIndex === snapshots.length - 1) {
                        setIsPlaying(false);
                      }
                      return Math.min(prevIndex + 1, snapshots.length - 1);
                    });
                  }, 1500); // Change snapshot every 1.5 seconds
                }
              }}
            />
            <Button
              minimal={true}
              disabled={activeSnapShotIndex >= snapshots.length - 1}
              icon={"fast-forward"}
              aria-label="Next version"
              onClick={() => {
                stopPlaying();

                setActiveSnapshotIndex(activeSnapShotIndex + 1);
              }}
            />
            <Button
              disabled={activeSnapShotIndex >= snapshots.length - 1}
              minimal={true}
              icon={"step-forward"}
              aria-label="Jump to latest"
              onClick={() => {
                stopPlaying();
                setActiveSnapshotIndex(snapshots.length - 1);
              }}
            />
          </div>

          {/* Action Button */}
          <div className="action-button-section">
            <Button
              intent={"danger"} // Or use custom class for specific red
              text="Restore"
              loading={restoring}
              onClick={async () => {
                // 
                setRestoring(true);
                console.log({ activeSnapShot })
                await window.roamAlphaAPI.updateBlock({
                  block: {
                    uid: uidRef.current,
                    string: activeSnapShot.string,
                  },
                });
                saveBlockSnapshot(uidRef.current, activeSnapShot.string)
                setRestoring(false);
                setOpen(false);
              }}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
