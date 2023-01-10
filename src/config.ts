let API: RoamExtensionAPI;
export function initConfig(extensionAPI: RoamExtensionAPI) {
  API = extensionAPI;
}

export function getPageSnapshot(page: string): { json: Snapshot; time: number }[] {
  const result = API.settings.get(page);
  if (!result) {
    return [];
  }
  try {
    return JSON.parse(result as string) as [];
  } catch (e) {
    return [];
  }
}

export function savePageSnapshot(page: string, snapshot: Snapshot) {
  const old = getPageSnapshot(page);
  old.push({
    json: snapshot,
    time: Date.now(),
  });
  API.settings.set(page, JSON.stringify(old));
}
