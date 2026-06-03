export function embedLyricsIntoM4a(
  buffer: ArrayBuffer,
  lyricsText: string,
  isEnhanced: boolean,
): Blob {
  let offset = 0;
  const view = new DataView(buffer);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");

  interface Box {
    type: string;
    size: number;
    headerSize: number;
    start: number;
    data?: Uint8Array;
    children?: Box[];
  }

  const containers = new Set(["moov", "udta", "ilst"]);

  function readBox(start: number, end: number, isMeta: boolean = false): Box[] {
    const boxes: Box[] = [];
    let p = start;
    if (isMeta) p += 4; // skip version/flags
    while (p < end) {
      if (p + 8 > end) break;
      let size = view.getUint32(p, false);
      const type = decoder.decode(new Uint8Array(buffer, p + 4, 4));
      let headerSize = 8;
      if (size === 1) {
        // 64-bit size, don't fully support large files > 4GB here for simplicity unless necessary, we just read lower 32-bits
        size = view.getUint32(p + 12, false);
        headerSize = 16;
      } else if (size === 0) {
        size = end - p;
      }
      if (p + size > end) size = end - p;

      const boxEnd = p + size;

      let children: Box[] | undefined;
      let data: Uint8Array | undefined;
      if (containers.has(type)) {
        children = readBox(p + headerSize, boxEnd, false);
      } else if (type === "meta") {
        children = readBox(p + headerSize, boxEnd, true);
      } else {
        data = new Uint8Array(buffer, p + headerSize, size - headerSize);
      }

      boxes.push({ type, size, start: p, headerSize, data, children });
      p += size;
    }
    return boxes;
  }

  const rootBoxes = readBox(0, buffer.byteLength);

  function findBox(boxes: Box[], type: string): Box | undefined {
    for (const b of boxes) {
      if (b.type === type) return b;
      if (b.children) {
        const found = findBox(b.children, type);
        if (found) return found;
      }
    }
  }

  function buildBox(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(8 + data.length);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, out.length, false);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    return out;
  }

  function buildMetaBox(childrenRaw: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + childrenRaw.length);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, out.length, false);
    for (let i = 0; i < 4; i++) out[4 + i] = "meta".charCodeAt(i);
    outView.setUint32(8, 0, false); // version + flags
    out.set(childrenRaw, 12);
    return out;
  }

  function flattenBoxes(boxes: Box[]): Uint8Array {
    let total = 0;
    const bufs: Uint8Array[] = [];
    for (const b of boxes) {
      if (b.children) {
        let inner: Uint8Array;
        if (b.type === "meta") inner = buildMetaBox(flattenBoxes(b.children));
        else inner = buildBox(b.type, flattenBoxes(b.children));
        bufs.push(inner);
        total += inner.length;
      } else if (b.data) {
        const cur = buildBox(b.type, b.data);
        bufs.push(cur);
        total += cur.length;
      } else {
        // shouldn't happen
        const cur = new Uint8Array(8);
        const cv = new DataView(cur.buffer);
        cv.setUint32(0, 8, false);
        for (let i = 0; i < 4; i++) cur[4 + i] = b.type.charCodeAt(i);
        bufs.push(cur);
        total += 8;
      }
    }
    const flat = new Uint8Array(total);
    let ptr = 0;
    for (const c of bufs) {
      flat.set(c, ptr);
      ptr += c.length;
    }
    return flat;
  }

  const moovIdx = rootBoxes.findIndex((x) => x.type === "moov");
  if (moovIdx === -1) throw new Error("No moov box found");
  const moov = rootBoxes[moovIdx];

  // ensure structure
  if (!moov.children) moov.children = [];
  let udta = moov.children.find((x) => x.type === "udta");
  if (!udta) {
    udta = { type: "udta", size: 0, start: 0, headerSize: 8, children: [] };
    moov.children.push(udta);
  }
  if (!udta.children) udta.children = [];

  let meta = udta.children.find((x) => x.type === "meta");
  if (!meta) {
    meta = { type: "meta", size: 0, start: 0, headerSize: 12, children: [] };
    udta.children.push(meta);
  }
  if (!meta.children) meta.children = [];

  let ilst = meta.children.find((x) => x.type === "ilst");
  if (!ilst) {
    ilst = { type: "ilst", size: 0, start: 0, headerSize: 8, children: [] };
    meta.children.push(ilst);
  }
  if (!ilst.children) ilst.children = [];

  // build lyrics data box
  const lyrTextUtf8 = encoder.encode(lyricsText);
  const dataBoxBody = new Uint8Array(8 + lyrTextUtf8.length);
  const dataBoxView = new DataView(dataBoxBody.buffer);
  dataBoxView.setUint32(0, 1, false); // type indicator: 1 = UTF-8 string
  dataBoxView.setUint32(4, 0, false); // locale indicator: 0
  dataBoxBody.set(lyrTextUtf8, 8);

  // Filter out existing lyrics if any
  ilst.children = ilst.children.filter((x) => x.type !== "©lyr");

  ilst.children.push({
    type: "©lyr",
    size: 0,
    start: 0,
    headerSize: 8,
    children: [
      {
        type: "data",
        size: 0,
        start: 0,
        headerSize: 8,
        data: dataBoxBody,
      },
    ],
  });

  const newMoovFlat = flattenBoxes([moov]);

  // Now recombine with mdat
  // Usually it's better to process boxes and write them dynamically
  const finalFileBufs: Uint8Array[] = [];
  let finalLength = 0;

  // Original boxes except we replace moov
  // Also if moov was before mdat and is now larger, it shifts mdat offsets!
  // MP4 stco/co64 boxes have absolute chunk offsets!
  // Changing moov size before mdat requires rewriting stco/co64.
  // To avoid rewriting chunk offsets, we can put the new moov at the END of the file,
  // and just not write the old moov.
  // Or, if moov was already at the end, we just append it.

  // Free the old moov by replacing it with a 'free' box
  const moovOriginStart = moov.start;
  const moovOriginSize = moov.size;
  const freeBox = new Uint8Array(moovOriginSize);
  const freeView = new DataView(freeBox.buffer);
  freeView.setUint32(0, moovOriginSize, false);
  for (let i = 0; i < 4; i++) freeBox[4 + i] = "free".charCodeAt(i);

  for (const rb of rootBoxes) {
    if (rb.type === "moov") {
      const temp = new Uint8Array(buffer, rb.start, rb.size);
      // Replace with free box
      finalFileBufs.push(freeBox);
      finalLength += freeBox.length;
    } else {
      const cur = new Uint8Array(buffer, rb.start, rb.size);
      finalFileBufs.push(cur);
      finalLength += cur.length;
    }
  }

  // Append new moov at the end
  finalFileBufs.push(newMoovFlat);
  finalLength += newMoovFlat.length;

  const finalFile = new Uint8Array(finalLength);
  let fp = 0;
  for (const b of finalFileBufs) {
    finalFile.set(b, fp);
    fp += b.length;
  }

  return new Blob([finalFile], { type: "audio/mp4" });
}
