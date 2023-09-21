export function emitCacheChangeEvent(uid: string) {
  const event = new CustomEvent<string>("cache-change", { detail: uid });
  document.dispatchEvent(event);
}

export function onCacheChangeEvent(fn: (event: unknown) => void) {
  document.addEventListener("cache-change", fn);
  return () => {
    document.removeEventListener("cache-change", fn);
  };
}


export function emitStartUploadEvent() {
  const event = new CustomEvent<string>("cache-upload", { detail: '' });
  document.dispatchEvent(event);
}

export function onStartUploadEvent(fn: (event: unknown) => void) {
  document.addEventListener("cache-upload", fn);
  return () => {
    document.removeEventListener("cache-change", fn);
  };
}

