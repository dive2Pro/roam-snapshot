import { Button, Dialog, Icon, MenuItem } from "@blueprintjs/core";
import { useState } from "react";
import ReactDom from "react-dom";
import Extension from "./extension";
import "arrive";

import { extension_helper } from "./helper";

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
  extension_helper.on_uninstall(() => {
    document.unbindArrive(selector, onArrive);
  });
}
