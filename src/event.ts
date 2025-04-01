export function emitBlockChangeEvent(uid: string) {
  const event = new CustomEvent<string>("block-change", { detail: uid });
  document.dispatchEvent(event);
}

export function onBlockChangeEvent(fn: (event: unknown) => void) {
  document.addEventListener("block-change", fn);
  return () => {
    document.removeEventListener("block-change", fn);
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

