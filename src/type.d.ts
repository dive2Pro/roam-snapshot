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
};

type Snapshot = {
  time: number;
  title: string;
  uid: string;
  children: SnapshotBlock[];
};
