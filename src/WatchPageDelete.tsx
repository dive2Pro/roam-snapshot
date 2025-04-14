import { Button, Classes, Dialog, Icon } from "@blueprintjs/core";
import { dbPageDeletedOpetator } from "./dbOperator";
import { extension_helper, getFullPageJson } from "./helper";
import ReactDOM from "react-dom";
import { useState } from "react";

export function initWatchPageDelete() {
  document.arrive(".rm-delete-page-modal .confirm-button", (el) => {
    el.addEventListener("pointerdown", (evt) => {
      const elm = el
        .closest(".rm-delete-page-modal")
        .querySelector("[data-link-uid]") as any;

      const uid = elm.dataset.linkUid;
      const snapshot = getFullPageJson(uid);
      console.log(evt, uid, snapshot);
      dbPageDeletedOpetator.update(uid, {
        snapshot,
        time: Date.now(),
      });
    });
  });
  document.arrive(".rm-graph-dropdown", (el) => {
    const sibling = el.querySelector(".bp3-menu-item.setting");
    const divider = document.createElement("li");
    // console.log(sibling, " -- ", sibling.parentElement);
    divider.className = "bp3-menu-divider";
    sibling.parentElement.insertBefore(divider, sibling);

    const container = document.createElement("li");
    // console.log(sibling, " -- ", sibling.parentElement);
    container.className = "bp3-menu-item trash";
    sibling.parentElement.insertBefore(container, sibling);

    ReactDOM.render(
      <div
        style={{
          padding: 0,
          display: "flex",
          gap: 8,
          alignItems: "center",
          width: "100%",
        }}
        aria-label="Close"
        className="bp3-popover-dismiss"
        onClick={() => {
          console.log("Hello  trash");
          const dialogEl = document.createElement("div");
          dialogEl.className = "rm-trash-el"
          document.body.appendChild(dialogEl);
          ReactDOM.render(
            <PageTrash
              onClose={() => {
                dialogEl.remove();
              }}
            />,
            dialogEl
          );
        }}
      >
        <Icon size={14} icon="trash" />
        Trash
      </div>,
      container
    );
  });
  extension_helper.on_uninstall(() => {
    document.unbindArrive(".rm-delete-page-modal .confirm-button");
    document.unbindArrive(".rm-graph-dropdown");
  });
}

function PageTrash(props: { onClose: () => void }) {
  const [isOpen, setOpen] = useState(true)
  return (
    <Dialog
      style={{
        width: "80%",
      }}
      onClose={() => {
        setOpen(false)
        props.onClose()
      }}
      isOpen={isOpen}
      
    >
      <div>Hello Trash</div>
    </Dialog>
  );
}
