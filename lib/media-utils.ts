export function extractFlacMetadata(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");
  const tagsMap = new Map<string, string>();
  const covers: { mime: string; url: string }[] = [];

  if (view.getUint32(0) !== 0x664c6143) {
    throw new Error("非標準 FLAC 檔案格式");
  }

  let offset = 4;
  let isLastBlock = false;

  while (!isLastBlock && offset < view.byteLength) {
    if (offset + 4 > view.byteLength) break;
    const blockHeader = view.getUint8(offset);
    isLastBlock = (blockHeader & 0x80) !== 0;
    const blockType = blockHeader & 0x7f;

    const length =
      (view.getUint8(offset + 1) << 16) |
      (view.getUint8(offset + 2) << 8) |
      view.getUint8(offset + 3);

    offset += 4; // Shift to block content

    if (offset + length > view.byteLength) break;

    if (blockType === 4) {
      let p = offset;
      const vendorLength = view.getUint32(p, true);
      p += 4 + vendorLength; // Skip vendor string

      const commentListLength = view.getUint32(p, true);
      p += 4;

      for (let i = 0; i < commentListLength; i++) {
        const commentLength = view.getUint32(p, true);
        p += 4;

        const commentBytes = new Uint8Array(buffer, p, commentLength);
        const commentStr = decoder.decode(commentBytes);
        p += commentLength;

        const equalIndex = commentStr.indexOf("=");
        if (equalIndex !== -1) {
          const key = commentStr.substring(0, equalIndex).toUpperCase();
          const value = commentStr.substring(equalIndex + 1);
          tagsMap.set(key, value);
        }
      }
    } else if (blockType === 6) {
      let p = offset;

      // Picture type (4 bytes)
      const pictureType = view.getUint32(p);
      p += 4;

      const mimeLength = view.getUint32(p);
      p += 4;

      const mimeBytes = new Uint8Array(buffer, p, mimeLength);
      const mimeTypeStr = decoder.decode(mimeBytes);
      p += mimeLength;

      const descLength = view.getUint32(p);
      p += 4 + descLength;

      p += 16;

      const dataLength = view.getUint32(p);
      p += 4;

      if (p + dataLength <= view.byteLength) {
        const pictureBytes = new Uint8Array(buffer, p, dataLength);
        const base64String = Array.from(pictureBytes)
          .map((byte) => String.fromCharCode(byte))
          .join("");
        const dataUrl = `data:${mimeTypeStr};base64,${window.btoa(base64String)}`;

        covers.push({
          mime: mimeTypeStr,
          url: dataUrl,
        });
      }
    }
    offset += length;
  }

  return { tags: tagsMap, covers };
}
