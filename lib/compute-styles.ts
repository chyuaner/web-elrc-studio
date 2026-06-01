import { LyricLine } from './lyric-utils';

export function computeEffectiveStyles(lines: LyricLine[]) {
    const lineStyles: (string | undefined)[] = [];
    const wordStyles: (string | undefined)[][] = [];
    const lineIsBoundary: boolean[] = [];
    const wordIsBoundary: boolean[][] = [];
    
    let currentStyle: string | undefined = undefined;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        let effectiveLineStyle = currentStyle;
        let pLineBoundary = false;
        if (line.style) {
            pLineBoundary = true;
            if (line.style === 'N') currentStyle = undefined;
            else currentStyle = line.style;
            effectiveLineStyle = currentStyle;
        }

        lineStyles.push(effectiveLineStyle);
        lineIsBoundary.push(pLineBoundary);

        const currentWordStyles: (string | undefined)[] = [];
        const currentWordBoundaries: boolean[] = [];
        let currentWordPropagatedStyle = effectiveLineStyle;
        let previousWordPropagatedStyle = effectiveLineStyle;

        for (let j = 0; j < line.words.length; j++) {
            const word = line.words[j];
            let pWordBoundary = false;
            if (word.style) {
                if (word.style !== previousWordPropagatedStyle) {
                    pWordBoundary = true;
                }
                if (word.style === 'N') {
                    currentWordPropagatedStyle = undefined;
                    currentStyle = undefined;
                } else {
                    currentWordPropagatedStyle = word.style;
                    currentStyle = word.style;
                }
            }
            previousWordPropagatedStyle = currentWordPropagatedStyle;
            currentWordStyles.push(currentWordPropagatedStyle);
            currentWordBoundaries.push(pWordBoundary);
        }

        wordStyles.push(currentWordStyles);
        wordIsBoundary.push(currentWordBoundaries);
    }
    return { lineStyles, wordStyles, lineIsBoundary, wordIsBoundary };
}

export function createEffectiveLines(lines: LyricLine[]): LyricLine[] {
     const effectiveStyles = computeEffectiveStyles(lines);
     return lines.map((line, i) => {
         const newLine = { ...line } as any;
         newLine.style = effectiveStyles.lineStyles[i];
         newLine._isStyleBoundary = effectiveStyles.lineIsBoundary[i];
         newLine.words = line.words.map((w, j) => ({
             ...w,
             style: effectiveStyles.wordStyles[i][j],
             _isStyleBoundary: effectiveStyles.wordIsBoundary[i][j]
         }));
         return newLine;
     });
}
