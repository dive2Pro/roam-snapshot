type RoamExtensionAPI = {
  settings: {
    get: (k: string) => unknown;
    getAll: () => Record<string, unknown>;
    panel: {
      create: (c: PanelConfig) => void;
    };
    set: (k: string, v: unknown) => Promise<void>;
  };
};

type SnapshotBlock = {
  open: boolean;
  order: number;
  parents: { id: number }[];
  string: string;
  time: number;
  uid: string;
  "text-align": "center" | "left" | "right";
  heading: number;
  "view-type": "bullet" | "numbered" | "document";
  children: SnapshotBlock[];
  added?: true;
  deleted?: true;
};

type Snapshot = {
  time: number;
  title: string;
  uid: string;
  children: SnapshotBlock[];
};

type DiffSnapshotBlock = {
  open?: {
    old: boolean;
    now: boolean;
  };
  order: number;
  string?: {
    old: string;
    now: string;
  };
  uid: string;
  "text-align"?: {
    old: "center" | "left" | "right";
    now: "center" | "left" | "right";
  };
  heading?: {
    old: number;
    now: number;
  };
  "view-type"?: {
    old: "bullet" | "numbered" | "document";
    now: "bullet" | "numbered" | "document";
  };
  children?: DiffSnapshotBlock[];
};
type DiffBlock = {
  changed?: Record<string, DiffSnapshotBlock>;
  deleted?: (SnapshotBlock & { parentUids: string[], deleted: true })[];
  added?: (SnapshotBlock & { parentUids: string[], added: true })[];
};
type Diff = {
  title?: {
    old: string;
    now: string;
  };
  block?: DiffBlock;
};
