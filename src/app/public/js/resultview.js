// Shows a finished PNG / GIF / video in the page with a download link (shared by the export
// studio and the clip maker). The file only ever lives in the browser's memory.

export const formatBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** @param {HTMLElement} box the element the result is shown in */
export function createResultView(box) {
  let url = null;
  return {
    /** @param {Blob} blob @param {{kind: 'png'|'gif'|'video', ext: string, name: string}} info */
    show(blob, { kind, ext, name }) {
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      box.replaceChildren();
      let media;
      if (kind === 'video') {
        media = document.createElement('video');
        media.controls = true;
        media.loop = true;
        media.muted = true;
        media.playsInline = true;
      } else {
        media = document.createElement('img');
        media.alt = kind === 'png' ? 'The exported image' : 'The exported GIF';
      }
      media.src = url;
      const link = document.createElement('a');
      link.className = 'download';
      link.href = url;
      link.download = name;
      link.textContent = `Download ${ext.toUpperCase()} (${formatBytes(blob.size)})`;
      box.append(media, link);
      box.hidden = false;
    },
    clear() {
      if (url) URL.revokeObjectURL(url);
      url = null;
      box.replaceChildren();
      box.hidden = true;
    },
  };
}
