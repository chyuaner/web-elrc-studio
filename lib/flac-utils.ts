export function embedLyricsIntoFlac(
  buffer: ArrayBuffer,
  lyricsText: string,
  isEnhanced: boolean,
): Blob {
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder();

  if (view.getUint32(0) !== 0x664c6143) {
    throw new Error("非標準 FLAC 檔案格式");
  }

  let offset = 4;
  let isLastBlock = false;

  // Collect all blocks to re-create them
  const blocks: { isLast: boolean; type: number; payload: Uint8Array }[] = [];
  let audioDataOffset = -1;

  while (!isLastBlock && offset < view.byteLength) {
    if (offset + 4 > view.byteLength) break;
    const blockHeader = view.getUint8(offset);
    isLastBlock = (blockHeader & 0x80) !== 0;
    const blockType = blockHeader & 0x7f;

    const length =
      (view.getUint8(offset + 1) << 16) |
      (view.getUint8(offset + 2) << 8) |
      view.getUint8(offset + 3);

    offset += 4;

    if (offset + length > view.byteLength) break;

    const payload = new Uint8Array(buffer, offset, length);
    blocks.push({ isLast: isLastBlock, type: blockType, payload: new Uint8Array(payload) });

    offset += length;
  }

  audioDataOffset = offset;
  const audioData = new Uint8Array(buffer, audioDataOffset);

  // Find VORBIS_COMMENT block
  const vorbisBlockIndex = blocks.findIndex((b) => b.type === 4);

  let vendorStringBytes = new Uint8Array(0);
  const tagsMap = new Map<string, string>();

  // Decode existing VORBIS_COMMENT tags
  if (vorbisBlockIndex !== -1) {
    const payload = blocks[vorbisBlockIndex].payload;
    const pView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    let p = 0;
    const vendorLength = pView.getUint32(p, true);
    p += 4;
    vendorStringBytes = payload.slice(p, p + vendorLength);
    p += vendorLength;

    const commentListLength = pView.getUint32(p, true);
    p += 4;

    for (let i = 0; i < commentListLength; i++) {
      if (p + 4 > payload.length) break;
      const commentLength = pView.getUint32(p, true);
      p += 4;

      if (p + commentLength > payload.length) break;
      const commentBytes = payload.slice(p, p + commentLength);
      const commentStr = decoder.decode(commentBytes);
      p += commentLength;

      const equalIndex = commentStr.indexOf("=");
      if (equalIndex !== -1) {
        const key = commentStr.substring(0, equalIndex);
        const value = commentStr.substring(equalIndex + 1);
        // Keep everything except existing lyrics
        const kUpper = key.toUpperCase();
        if (
          kUpper !== "LYRICS" &&
          kUpper !== "UNSYNCEDLYRICS" &&
          kUpper !== "UNSYNCED LYRICS" &&
          !kUpper.startsWith("©LYR")
        ) {
          tagsMap.set(key, value);
        }
      }
    }
  } else {
    vendorStringBytes = encoder.encode("Enhanced LRC Studio");
  }

  // Set new lyrics tag
  const targetTagKey = isEnhanced ? "LYRICS" : "UNSYNCEDLYRICS";
  tagsMap.set(targetTagKey, lyricsText);

  // Build new VORBIS_COMMENT payload
  let commentsPayloadLength = 0;
  const encodedComments: Uint8Array[] = [];

  for (const [key, value] of tagsMap) {
    const cBytes = encoder.encode(`${key}=${value}`);
    encodedComments.push(cBytes);
    commentsPayloadLength += 4 + cBytes.length;
  }

  const newVorbisPayloadTotalLength = 4 + vendorStringBytes.length + 4 + commentsPayloadLength;
  const newVorbisPayload = new Uint8Array(newVorbisPayloadTotalLength);
  const newVorbisView = new DataView(
    newVorbisPayload.buffer,
    newVorbisPayload.byteOffset,
    newVorbisPayload.byteLength,
  );

  let wp = 0;
  // write vendor
  newVorbisView.setUint32(wp, vendorStringBytes.length, true);
  wp += 4;
  newVorbisPayload.set(vendorStringBytes, wp);
  wp += vendorStringBytes.length;
  // write list length
  newVorbisView.setUint32(wp, encodedComments.length, true);
  wp += 4;

  for (const cBytes of encodedComments) {
    newVorbisView.setUint32(wp, cBytes.length, true);
    wp += 4;
    newVorbisPayload.set(cBytes, wp);
    wp += cBytes.length;
  }

  if (vorbisBlockIndex !== -1) {
    blocks[vorbisBlockIndex].payload = newVorbisPayload;
  } else {
    const paddingIndex = blocks.findIndex((b) => b.type === 1);
    if (paddingIndex !== -1) {
      blocks.splice(paddingIndex, 0, { isLast: false, type: 4, payload: newVorbisPayload });
    } else {
      blocks.push({ isLast: false, type: 4, payload: newVorbisPayload });
    }
  }

  // Fix up isLast flags
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].isLast = i === blocks.length - 1;
  }

  let finalSize = 4; // 'fLaC'
  for (const b of blocks) {
    finalSize += 4 + b.payload.length;
  }
  finalSize += audioData.length;

  const finalBuffer = new Uint8Array(finalSize);
  finalBuffer.set(encoder.encode("fLaC"), 0);
  let fp = 4;

  for (const b of blocks) {
    let blockHeader = b.type & 0x7f;
    if (b.isLast) blockHeader |= 0x80;
    finalBuffer[fp] = blockHeader;
    finalBuffer[fp + 1] = (b.payload.length >> 16) & 0xff;
    finalBuffer[fp + 2] = (b.payload.length >> 8) & 0xff;
    finalBuffer[fp + 3] = b.payload.length & 0xff;
    fp += 4;
    finalBuffer.set(b.payload, fp);
    fp += b.payload.length;
  }

  finalBuffer.set(audioData, fp);

  return new Blob([finalBuffer], { type: "audio/flac" });
}
