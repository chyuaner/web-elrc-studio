import { LyricLine, computeWordEndTimesForLines } from "./lyric-utils";

export function computeEffectiveStyles(lines: LyricLine[]) {
  const lineStyles: (string | undefined)[] = [];
  const wordStyles: (string | undefined)[][] = [];
  const lineIsBoundary: boolean[] = [];
  const wordIsBoundary: boolean[][] = [];

  let currentStyle: string | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let pLineBoundary = line.style !== undefined;
    let effectiveLineStyle = currentStyle;
    if (line.style) {
      if (line.style === "N") currentStyle = undefined;
      else currentStyle = line.style;
      effectiveLineStyle = currentStyle;
    }

    lineStyles.push(effectiveLineStyle);
    lineIsBoundary.push(pLineBoundary);

    const currentWordStyles: (string | undefined)[] = [];
    const currentWordBoundaries: boolean[] = [];
    let currentWordPropagatedStyle = effectiveLineStyle;

    for (let j = 0; j < line.words.length; j++) {
      const word = line.words[j];
      let pWordBoundary = word.style !== undefined;

      if (word.style) {
        if (word.style === "N") {
          currentWordPropagatedStyle = undefined;
          currentStyle = undefined;
        } else {
          currentWordPropagatedStyle = word.style;
          currentStyle = word.style;
        }
      }

      currentWordStyles.push(currentWordPropagatedStyle);
      currentWordBoundaries.push(pWordBoundary);
    }

    wordStyles.push(currentWordStyles);
    wordIsBoundary.push(currentWordBoundaries);
  }
  return { lineStyles, wordStyles, lineIsBoundary, wordIsBoundary };
}

export function createEffectiveLines(lines: LyricLine[]): LyricLine[] {
  const linesWithWordEnds = computeWordEndTimesForLines(lines);
  const effectiveStyles = computeEffectiveStyles(linesWithWordEnds);
  return linesWithWordEnds.map((line, i) => {
    const newLine = { ...line } as any;
    newLine.style = effectiveStyles.lineStyles[i];
    newLine._isStyleBoundary = effectiveStyles.lineIsBoundary[i];
    newLine.words = line.words.map((w, j) => ({
      ...w,
      style: effectiveStyles.wordStyles[i][j],
      _isStyleBoundary: effectiveStyles.wordIsBoundary[i][j],
    }));
    return newLine;
  });
}
