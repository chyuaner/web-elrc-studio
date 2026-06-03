import * as OpenCC from "opencc-js";

let t2sConverter: ((text: string) => string) | null = null;
let s2tConverter: ((text: string) => string) | null = null;

export function convertToSimplified(text: string): string {
  if (!t2sConverter) {
    t2sConverter = OpenCC.Converter({ from: "tw", to: "cn" });
  }
  return t2sConverter(text);
}

export function convertToTraditional(text: string): string {
  if (!s2tConverter) {
    s2tConverter = OpenCC.Converter({ from: "cn", to: "tw" });
  }
  return s2tConverter(text);
}
