export function useSnapshot() {
  if (!import.meta.client) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  function captureFrame(videoEl: HTMLVideoElement, w = 720, h = 360, q = 0.7) {
    if (!ctx) {
      console.log("Error while getting canvas context");
      return;
    }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(videoEl, 0, 0, w, h);

    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", q);
    });
  }

  return { captureFrame };
}
