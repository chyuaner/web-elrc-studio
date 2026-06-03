const fs = require("fs");

let content = fs.readFileSync("components/layout/TopToolbar.tsx", "utf8");

// Find processAudioFile
const pAStart = content.indexOf(
  "  const processAudioFile = React.useCallback(async (f: File) => {",
);
const pAEnd = content.indexOf("  // AppCommands mapping extracted from useEditor hooks above");

if (pAStart !== -1 && pAEnd !== -1) {
  content = content.substring(0, pAStart) + content.substring(pAEnd);
}

// Find clearLyrics
const cLStart = content.indexOf("  const clearLyrics = async () => {");
const cLEnd = content.indexOf("  };\n\n  const clearMedia = async () => {");

// The clearMedia needs to be removed as well
if (cLStart !== -1) {
  const endStr = "  };\n\n";
  const cL2End =
    content.indexOf("  };\n", content.indexOf("  const clearMedia = async () => {") + 30) + 4;
  if (cL2End !== -1) {
    let before = content.substring(0, cLStart);
    let after = content.substring(cL2End);
    content = before + after;
  }
}

// Fix AppCommands mapping
content = content.replace(
  /clearMedia:\s*async\s*\(\)\s*=>\s*\{[^}]*setAudioSpecs\(null\);\s*\}\s*\}\s*\}/gm,
  "clearMedia: clearMedia",
);
content = content.replace(
  /clearLyrics:\s*async\s*\(\)\s*=>\s*\{[^}]*setLyricFileName\(null\);\s*\}\s*\}\s*\}/gm,
  "clearLyrics: clearLyrics",
);
content = content.replace(
  /loadEmbeddedLyrics:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\},/g,
  "loadEmbeddedLyrics: async () => { loadEmbeddedLyrics(metadata); },",
);

fs.writeFileSync("components/layout/TopToolbar.tsx", content, "utf8");

console.log("Done extracting");
