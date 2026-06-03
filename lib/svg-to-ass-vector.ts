/**
 * 將 SVG 向量圖形轉換為 ASS 字幕 \p1 繪圖指令。
 * 支援 path / rect / circle / ellipse / polygon / polyline / line，以及基本 fill 色彩。
 */

export interface AssVectorItem {
  path: string;
  fillColor?: string; // ASS 格式 &H00BBGGRR
  strokeColor?: string;
  strokeWidth?: number;
  strokeOnly?: boolean;
}

export interface AssVectorGraphic {
  width: number;
  height: number;
  items: AssVectorItem[];
}

function hexToAssColor(hex: string): string {
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (cleanHex.length === 6) {
    const r = cleanHex.slice(0, 2);
    const g = cleanHex.slice(2, 4);
    const b = cleanHex.slice(4, 6);
    return `&H00${b}${g}${r}`;
  }
  return "&H00FFFFFF";
}

function parseCssColor(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (v === "none" || v === "transparent") return undefined;
  if (v.startsWith("#")) return hexToAssColor(v);
  const rgbMatch = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
    return hexToAssColor(`#${r}${g}${b}`);
  }
  const named: Record<string, string> = {
    white: "#FFFFFF",
    black: "#000000",
    red: "#FF0000",
    green: "#008000",
    blue: "#0000FF",
  };
  if (named[v]) return hexToAssColor(named[v]);
  return undefined;
}

function parseStyleBlock(svgText: string): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  const styleMatch = svgText.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return map;

  const ruleRegex = /\.([\w-]+)\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRegex.exec(styleMatch[1])) !== null) {
    const props: Record<string, string> = {};
    m[2].split(";").forEach((decl) => {
      const [key, val] = decl.split(":").map((s) => s.trim());
      if (key && val) props[key] = val;
    });
    map.set(m[1], props);
  }
  return map;
}

function parseInlineStyle(style: string): Record<string, string> {
  const props: Record<string, string> = {};
  style.split(";").forEach((decl) => {
    const [key, val] = decl.split(":").map((s) => s.trim());
    if (key && val) props[key] = val;
  });
  return props;
}

interface Transform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiplyTransform(t1: Transform, t2: Transform): Transform {
  return {
    a: t1.a * t2.a + t1.c * t2.b,
    b: t1.b * t2.a + t1.d * t2.b,
    c: t1.a * t2.c + t1.c * t2.d,
    d: t1.b * t2.c + t1.d * t2.d,
    e: t1.a * t2.e + t1.c * t2.f + t1.e,
    f: t1.b * t2.e + t1.d * t2.f + t1.f,
  };
}

function applyTransform(x: number, y: number, t: Transform): [number, number] {
  return [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f];
}

function parseTransformAttr(value: string): Transform {
  let result = { ...IDENTITY };
  const fnRegex = /(matrix|translate|scale|rotate)\s*\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRegex.exec(value)) !== null) {
    const nums = m[2]
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    let t = { ...IDENTITY };
    switch (m[1]) {
      case "matrix":
        if (nums.length >= 6) {
          t = {
            a: nums[0],
            b: nums[1],
            c: nums[2],
            d: nums[3],
            e: nums[4],
            f: nums[5],
          };
        }
        break;
      case "translate":
        t = { ...IDENTITY, e: nums[0] || 0, f: nums[1] || 0 };
        break;
      case "scale": {
        const sx = nums[0] ?? 1;
        const sy = nums[1] ?? sx;
        t = { ...IDENTITY, a: sx, d: sy };
        break;
      }
      case "rotate": {
        const rad = ((nums[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        t = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
        break;
      }
    }
    result = multiplyTransform(result, t);
  }
  return result;
}

function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- SVG path d → ASS drawing commands ---

function quadToCubic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number, number, number, number, number] {
  return [
    x0 + (2 / 3) * (x1 - x0),
    y0 + (2 / 3) * (y1 - y0),
    x2 + (2 / 3) * (x1 - x2),
    y2 + (2 / 3) * (y1 - y2),
    x2,
    y2,
  ];
}

function arcToCubics(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  phi: number,
  largeArc: boolean,
  sweep: boolean,
  x: number,
  y: number,
): [number, number, number, number, number, number][] {
  if (rx === 0 || ry === 0) {
    return [[x0, y0, x, y, x, y]];
  }
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }
  const sign = largeArc === sweep ? -1 : 1;
  const sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq);
  const coef = sign * Math.sqrt(Math.max(0, sq));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    let ang = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta =
    angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry) % (2 * Math.PI);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const deltaSeg = delta / segments;
  const result: [number, number, number, number, number, number][] = [];
  let curX = x0;
  let curY = y0;
  for (let i = 0; i < segments; i++) {
    const t1 = theta1 + i * deltaSeg;
    const t2 = t1 + deltaSeg;
    const cosT1 = Math.cos(t1);
    const sinT1 = Math.sin(t1);
    const cosT2 = Math.cos(t2);
    const sinT2 = Math.sin(t2);
    const ex = cx + rx * cosPhi * cosT2 - ry * sinPhi * sinT2;
    const ey = cy + rx * sinPhi * cosT2 + ry * cosPhi * sinT2;
    const alpha = (4 / 3) * Math.tan((t2 - t1) / 4);
    const c1x = curX + alpha * (-rx * cosPhi * sinT1 - ry * sinPhi * cosT1);
    const c1y = curY + alpha * (-rx * sinPhi * sinT1 + ry * cosPhi * cosT1);
    const c2x = ex + alpha * (rx * cosPhi * sinT2 + ry * sinPhi * cosT2);
    const c2y = ey + alpha * (rx * sinPhi * sinT2 - ry * cosPhi * cosT2);
    result.push([c1x, c1y, c2x, c2y, ex, ey]);
    curX = ex;
    curY = ey;
  }
  return result;
}

function svgPathToAss(d: string, transform: Transform): string {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return "";

  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let subStartX = 0;
  let subStartY = 0;
  let prevCubicX2 = 0;
  let prevCubicY2 = 0;
  let prevQuadX = 0;
  let prevQuadY = 0;
  let prevCmd = "";
  const parts: string[] = [];

  const readNum = () => parseFloat(tokens[i++]);
  const tx = (x: number, y: number) => {
    const [nx, ny] = applyTransform(x, y, transform);
    return [roundCoord(nx), roundCoord(ny)] as const;
  };
  const emitMove = (x: number, y: number) => {
    const [nx, ny] = tx(x, y);
    parts.push(`m ${nx} ${ny}`);
  };
  const emitLine = (x: number, y: number) => {
    const [nx, ny] = tx(x, y);
    parts.push(`l ${nx} ${ny}`);
  };
  const emitCubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    const [nx1, ny1] = tx(x1, y1);
    const [nx2, ny2] = tx(x2, y2);
    const [nx, ny] = tx(x, y);
    parts.push(`b ${nx1} ${ny1} ${nx2} ${ny2} ${nx} ${ny}`);
    cx = x;
    cy = y;
    prevCubicX2 = x2;
    prevCubicY2 = y2;
  };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[a-zA-Z]$/.test(tok)) {
      cmd = tok;
      i++;
    } else if (!cmd) {
      cmd = "M";
    }

    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();

    switch (C) {
      case "M": {
        const x = rel ? cx + readNum() : readNum();
        const y = rel ? cy + readNum() : readNum();
        cx = x;
        cy = y;
        subStartX = x;
        subStartY = y;
        emitMove(x, y);
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        const x = rel ? cx + readNum() : readNum();
        const y = rel ? cy + readNum() : readNum();
        emitLine(x, y);
        cx = x;
        cy = y;
        break;
      }
      case "H": {
        const x = rel ? cx + readNum() : readNum();
        emitLine(x, cy);
        cx = x;
        break;
      }
      case "V": {
        const y = rel ? cy + readNum() : readNum();
        emitLine(cx, y);
        cy = y;
        break;
      }
      case "C": {
        const x1 = rel ? cx + readNum() : readNum();
        const y1 = rel ? cy + readNum() : readNum();
        const x2 = rel ? cx + readNum() : readNum();
        const y2 = rel ? cy + readNum() : readNum();
        const x = rel ? cx + readNum() : readNum();
        const y = rel ? cy + readNum() : readNum();
        emitCubic(x1, y1, x2, y2, x, y);
        break;
      }
      case "S": {
        let x1 = cx;
        let y1 = cy;
        if (prevCmd === "C" || prevCmd === "S") {
          x1 = 2 * cx - prevCubicX2;
          y1 = 2 * cy - prevCubicY2;
        }
        const x2 = rel ? cx + readNum() : readNum();
        const y2 = rel ? cy + readNum() : readNum();
        const x = rel ? cx + readNum() : readNum();
        const y = rel ? cy + readNum() : readNum();
        emitCubic(x1, y1, x2, y2, x, y);
        break;
      }
      case "Q": {
        const x1 = rel ? cx + readNum() : readNum();
        const y1 = rel ? cy + readNum() : readNum();
        const x = rel ? cx + readNum() : readNum();
        const y = rel ? cy + readNum() : readNum();
        const c = quadToCubic(cx, cy, x1, y1, x, y);
        emitCubic(c[0], c[1], c[2], c[3], c[4], c[5]);
        prevQuadX = x1;
        prevQuadY = y1;
        break;
      }
      case "T": {
        let x1 = cx;
        let y1 = cy;
        if (prevCmd === "Q" || prevCmd === "T") {
          x1 = 2 * cx - prevQuadX;
          y1 = 2 * cy - prevQuadY;
        }
        const x = rel ? cx + readNum() : readNum();
        const y = rel ? cy + readNum() : readNum();
        const c = quadToCubic(cx, cy, x1, y1, x, y);
        emitCubic(c[0], c[1], c[2], c[3], c[4], c[5]);
        prevQuadX = x1;
        prevQuadY = y1;
        break;
      }
      case "A": {
        const rx = readNum();
        const ry = readNum();
        const rot = (readNum() * Math.PI) / 180;
        const largeArc = readNum() !== 0;
        const sweep = readNum() !== 0;
        const x = rel ? cx + readNum() : readNum();
        const y = rel ? cy + readNum() : readNum();
        const cubics = arcToCubics(cx, cy, rx, ry, rot, largeArc, sweep, x, y);
        for (const c of cubics) {
          emitCubic(c[0], c[1], c[2], c[3], c[4], c[5]);
        }
        break;
      }
      case "Z": {
        if (cx !== subStartX || cy !== subStartY) {
          emitLine(subStartX, subStartY);
        }
        cx = subStartX;
        cy = subStartY;
        break;
      }
      default:
        i++;
    }
    prevCmd = C;
  }

  return parts.join(" ");
}

function rectToPath(x: number, y: number, w: number, h: number, rx = 0, ry = 0): string {
  if (rx === 0 && ry === 0) {
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  }
  ry = ry || rx;
  return `M ${x + rx} ${y} L ${x + w - rx} ${y} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} L ${x + w} ${y + h - ry} A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} L ${x + rx} ${y + h} A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} L ${x} ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
}

function circleToPath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

function getElementStyles(
  el: Element,
  cssClasses: Map<string, Record<string, string>>,
): { fill?: string; stroke?: string; strokeWidth?: number } {
  const result: { fill?: string; stroke?: string; strokeWidth?: number } = {};
  const cls = el.getAttribute("class");
  if (cls) {
    cls.split(/\s+/).forEach((c) => {
      const props = cssClasses.get(c);
      if (props) {
        if (props.fill) result.fill = props.fill;
        if (props.stroke) result.stroke = props.stroke;
        if (props["stroke-width"]) result.strokeWidth = parseFloat(props["stroke-width"]);
      }
    });
  }
  const styleAttr = el.getAttribute("style");
  if (styleAttr) {
    const inline = parseInlineStyle(styleAttr);
    if (inline.fill) result.fill = inline.fill;
    if (inline.stroke) result.stroke = inline.stroke;
    if (inline["stroke-width"]) result.strokeWidth = parseFloat(inline["stroke-width"]);
  }
  if (el.getAttribute("fill")) result.fill = el.getAttribute("fill")!;
  if (el.getAttribute("stroke")) result.stroke = el.getAttribute("stroke")!;
  if (el.getAttribute("stroke-width"))
    result.strokeWidth = parseFloat(el.getAttribute("stroke-width")!);

  return result;
}

function collectElements(
  parent: Element,
  cssClasses: Map<string, Record<string, string>>,
  inheritedTransform: Transform,
  items: AssVectorItem[],
): void {
  for (const child of Array.from(parent.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === "style" || tag === "defs" || tag === "text") continue;

    let transform = inheritedTransform;
    const transformAttr = child.getAttribute("transform");
    if (transformAttr) {
      transform = multiplyTransform(inheritedTransform, parseTransformAttr(transformAttr));
    }

    const styles = getElementStyles(child, cssClasses);
    const fillAss = styles.fill ? parseCssColor(styles.fill) : undefined;
    const strokeAss = styles.stroke ? parseCssColor(styles.stroke) : undefined;
    const strokeWidth = styles.strokeWidth ?? 1;
    const fillIsNone = styles.fill === "none";
    const strokeIsNone = styles.stroke === "none" || !strokeAss;

    let d = "";
    if (tag === "path") {
      d = child.getAttribute("d") || "";
    } else if (tag === "rect") {
      d = rectToPath(
        parseFloat(child.getAttribute("x") || "0"),
        parseFloat(child.getAttribute("y") || "0"),
        parseFloat(child.getAttribute("width") || "0"),
        parseFloat(child.getAttribute("height") || "0"),
        parseFloat(child.getAttribute("rx") || "0"),
        parseFloat(child.getAttribute("ry") || "0"),
      );
    } else if (tag === "circle") {
      d = circleToPath(
        parseFloat(child.getAttribute("cx") || "0"),
        parseFloat(child.getAttribute("cy") || "0"),
        parseFloat(child.getAttribute("r") || "0"),
      );
    } else if (tag === "ellipse") {
      const cx = parseFloat(child.getAttribute("cx") || "0");
      const cy = parseFloat(child.getAttribute("cy") || "0");
      const rx = parseFloat(child.getAttribute("rx") || "0");
      const ry = parseFloat(child.getAttribute("ry") || "0");
      d = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    } else if (tag === "polygon" || tag === "polyline") {
      const pts = (child.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (pts.length >= 2) {
        d = `M ${pts[0]} ${pts[1]}`;
        for (let p = 2; p < pts.length; p += 2) {
          d += ` L ${pts[p]} ${pts[p + 1]}`;
        }
        if (tag === "polygon") d += " Z";
      }
    } else if (tag === "line") {
      d = `M ${child.getAttribute("x1")} ${child.getAttribute("y1")} L ${child.getAttribute("x2")} ${child.getAttribute("y2")}`;
    } else if (tag === "g") {
      collectElements(child, cssClasses, transform, items);
      continue;
    }

    if (d) {
      const assPath = svgPathToAss(d, transform);
      if (assPath) {
        if (fillAss && !fillIsNone) {
          items.push({ path: assPath, fillColor: fillAss });
        } else if (strokeAss && !strokeIsNone) {
          items.push({
            path: assPath,
            strokeColor: strokeAss,
            strokeWidth,
            strokeOnly: true,
          });
        }
      }
    } else if (tag === "g") {
      collectElements(child, cssClasses, transform, items);
    }
  }
}

export function scaleAssVectorPath(path: string, scale: number): string {
  const parts = path.trim().split(/\s+/);
  const result: string[] = [];
  for (const part of parts) {
    if (/^[a-z]$/i.test(part)) {
      result.push(part);
    } else {
      result.push(String(roundCoord(parseFloat(part) * scale)));
    }
  }
  return result.join(" ");
}

export function parseSvgToAssVector(svgText: string): AssVectorGraphic | null {
  if (typeof DOMParser === "undefined") return null;

  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;

    const parseError = doc.querySelector("parsererror");
    if (parseError) return null;

    let width = 0;
    let height = 0;
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length >= 4) {
        width = parts[2];
        height = parts[3];
      }
    }
    if (!width) width = parseFloat(svg.getAttribute("width") || "0");
    if (!height) height = parseFloat(svg.getAttribute("height") || "0");
    if (!width || !height) return null;

    const cssClasses = parseStyleBlock(svgText);
    const items: AssVectorItem[] = [];
    collectElements(svg, cssClasses, IDENTITY, items);

    if (items.length === 0) return null;

    return { width, height, items };
  } catch {
    return null;
  }
}
