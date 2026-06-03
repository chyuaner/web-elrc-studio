const fs = require("fs");
const path = require("path");

const dir = "./components";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
files.push("./app/page.tsx");
files.push("./app/globals.css"); // Wait, I don't want to replace colors in globals.css, I need to define them there!

const mapping = {
  "#0F1115": "var(--app-bg-base)",
  "#1A1D23": "var(--app-bg-panel)",
  "#16191E": "var(--app-bg-panel-alt)",
  "#08090C": "var(--app-bg-input)",
  "#2D333B": "var(--app-border-base)",
  "#444C56": "var(--app-border-light)",
  "#3D444D": "var(--app-bg-hover)",
  "#E0E0E0": "var(--app-text-secondary)",
  "#7D8590": "var(--app-text-muted)",
  "#F27D26": "var(--app-accent)",
  "#E26D16": "var(--app-accent-hover)",
};

files.forEach((file) => {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  for (const [hex, variable] of Object.entries(mapping)) {
    const regex = new RegExp(`\\[${hex}\\]`, "gi");
    content = content.replace(regex, `[${variable}]`);

    const directRegex = new RegExp(`'${hex}'`, "gi");
    content = content.replace(directRegex, `'${variable}'`);

    const doubleRegex = new RegExp(`"${hex}"`, "gi");
    content = content.replace(doubleRegex, `"${variable}"`);
  }

  // also text-white / text-black
  // wait, don't blindly replace text-white because it might be needed.
  // actually, let's keep text-white but replace bg-black
  // only replace text-white with text-[var(--app-text-primary)]
  // and bg-black with bg-[var(--app-text-primary)]
  content = content.replace(/\btext-white\b/g, "text-[var(--app-text-primary)]");
  content = content.replace(
    /\bbg-black\b/g,
    "bg-[var(--app-text-primary)] text-[var(--app-bg-base)]",
  );

  fs.writeFileSync(filePath, content, "utf-8");
});
