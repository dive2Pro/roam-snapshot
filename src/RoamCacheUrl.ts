import { PullBlock } from "roamjs-components/types";

const getNthChildUidByBlockUid = ({
  blockUid, order,
}: {
  blockUid: string;
  order: number;
}): string => (
  window.roamAlphaAPI.data.fast.q(
    `[:find (pull ?c [:block/uid]) :where [?p :block/uid "${blockUid}"] [?p :block/children ?c] [?c :block/order ${order}] ]`
  )?.[0]?.[0] as PullBlock
)?.[":block/uid"] || "";
const creaetOrGetFirstChildUidByPageUid = async (pageUid: string) => {
  let uid = getNthChildUidByBlockUid({
    blockUid: pageUid,
    order: 0,
  });
  if (uid) {
    return uid;
  }
  uid = window.roamAlphaAPI.util.generateUID();
  console.log(pageUid, uid, " ---");

  await window.roamAlphaAPI.createBlock({
    block: {
      uid,
      string: "",
    },
    location: {
      "parent-uid": pageUid,
      order: 0,
    },
  });
  return uid;
};
const getTextByBlockUid = (uid = ""): string => (uid &&
  window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid])?.[":block/string"]) ||
  "";
const getEditTimeByBlockUid = (uid = "") => (uid &&
  window.roamAlphaAPI.pull("[:edit/time]", [":block/uid", uid])?.[":edit/time"]) ||
  0;
const getPageUidByPageTitle = (title: string): string => window.roamAlphaAPI.pull("[:block/uid]", [":node/title", title])?.[":block/uid"] || "";
class RoamCacheUrl {
  pageTitle = "roam/plugin/PageHistory";
  pageUid = "";
  firstChildUid = "";
  url = "";
  constructor() {
    this.init();
  }
  async init() {
    await this.getPageUid();
    await this.getFirstChildUid();
    this.loadUrl();
  }
  async getFirstChildUid() {
    this.firstChildUid = await creaetOrGetFirstChildUidByPageUid(this.pageUid);
  }

  async getPageUid() {
    try {
      const uid = await window.roamAlphaAPI.util.generateUID();
      await window.roamAlphaAPI.createPage({
        page: {
          title: this.pageTitle,
          uid,
        },
      });
      this.pageUid = uid;
    } catch (e) {
      // 通过 page/title 获取 uid
      this.pageUid = getPageUidByPageTitle(this.pageTitle);
    }
  }
  saveUrl(url: string) {
    return window.roamAlphaAPI.updateBlock({
      block: {
        uid: this.firstChildUid,
        string: url,
      },
    });
  }

  loadUrl() {
    this.url = getTextByBlockUid(this.firstChildUid);
    return this.url;
  }

  getUrlChangeTime() {
    return getEditTimeByBlockUid(this.firstChildUid);
  }
}
export const roamCacheUrl = new RoamCacheUrl();
