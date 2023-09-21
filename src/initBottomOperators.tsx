import { Button, Classes, Popover } from "@blueprintjs/core";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { getUploadIntervalTime, saveToServer } from "./config";
import { extension_helper, minute_1 } from "./helper";
import { onCacheChangeEvent } from "./event";

function BottomOperators() {
  const [state, setState] = useState({
    uploading: false,
    counting: false,
    lastMinutes: 0,
  });
  useEffect(() => {
    const startUpload = async () => {
      setState((prev) => ({ ...prev, uploading: true }));
      await saveToServer();
      setState((prev) => ({
        ...prev,
        uploading: false,
        counting: false,
      }));
    };
    let clear = () => {
      //
    };
    const startCount = () => {
      const timer = setInterval(() => {
        setState((prev) => {
          if (prev.lastMinutes <= 1) {
            clearInterval(timer);
            if (prev.uploading) {
              return {
                ...prev,
                lastMinutes: 0,
                counting: false,
              };
            } else {
              startUpload();
              return {
                ...prev,
                lastMinutes: 0,
                counting: false,
              };
            }
          }
          return {
            ...prev,
            lastMinutes: prev.lastMinutes - 1,
          };
        });
      }, minute_1);
      clear = () => {
        clearInterval(timer);
      };
    };

    const off = onCacheChangeEvent((event: { detail: string }) => {
      setState((prev) => {
        if (prev.counting) {
          return prev;
        }
        startCount();
        return {
          ...prev,
          lastMinutes: getUploadIntervalTime(),
          counting: true,
        };
      });
    });
    return () => {
      off();
      clear();
    };
  }, []);

  return (
    <div
      style={
        state.counting || state.uploading
          ? {
              display: "block",
            }
          : { display: "none" }
      }
    >
      <Popover
        disabled={state.uploading}
        interactionKind="hover-target"
        content={
          <div className={Classes.DIALOG_BODY}>
            <h4>Page History</h4>
            Time until the next synchronization to service: ... Click to
            synchronize immediately.
          </div>
        }
      >
        <Button
          loading={state.uploading}
          onClick={async () => {
            if (state.counting) {
              setState((prev) => ({ ...prev, uploading: true }));
              await saveToServer();
              setState((prev) => ({
                ...prev,
                uploading: false,
                counting: false,
              }));
            }
          }}
          icon="cloud-upload"
          large
        />
      </Popover>
    </div>
  );
}
export function initBottomOperators() {
  const app = document.querySelector("#app");
  const el = document.createElement("div");
  el.className = "rm-history-server-el";
  app.appendChild(el);

  ReactDOM.render(<BottomOperators />, el);

  extension_helper.on_uninstall(() => {
    el.remove();
  });
}
