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
  order: string;
  parents: { id: number }[];
  string: string;
  time: number;
  uid: string;
  "text-align": string;
  heading: number;
  "view-type": string;
  children: SnapshotBlock[];
};

type Snapshot = {
  time: number;
  title: string;
  uid: string;
  children: SnapshotBlock[];
};
