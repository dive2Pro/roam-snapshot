import { extension_helper } from "./helper";
import { initExtension } from "./extension";
import { initTopbarIcon } from "./topbar-icon";
import { initConfig } from "./config";
import { syncCache } from "./syncCache";
// import { initWatchPageDelete } from "./WatchPageDelete";

function onload({ extensionAPI }: { extensionAPI: RoamExtensionAPI }) {
  initConfig(extensionAPI);
  initTopbarIcon(extensionAPI)
  initExtension();
  syncCache();
  // initWatchPageDelete()
}

function onunload() {
  extension_helper.uninstall();
}

export default {
  onload,
  onunload,
};
