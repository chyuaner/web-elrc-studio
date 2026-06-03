const fs = require("fs");
const path = require("path");

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
      results.push(file);
    }
  });
  return results;
};

const files = [...walk("./components"), ...walk("./app")];

const componentMap = {
  useGlobalHotkeys: "base/useGlobalHotkeys",
  useAutoScroll: "base/useAutoScroll",
  useSyncHotkeys: "base/useSyncHotkeys",
  EditorProvider: "base/EditorProvider",
  WebSystemIntegration: "base/WebSystemIntegration",
  ElectronWindowControls: "base/ElectronWindowControls",

  ResizableLayout: "layout/ResizableLayout",
  EditorView: "layout/EditorView",
  TopToolbar: "layout/TopToolbar",

  MediaPlayer: "panel/MediaPlayer",
  TextEditor: "panel/TextEditor",
  SyncEditor: "panel/SyncEditor",
  RawTextDisplay: "panel/RawTextDisplay",
  KaraokePreview: "panel/KaraokePreview",
  LeftPanelInfo: "panel/LeftPanelInfo",
  LyricCell: "panel/LyricCell",

  DialogProvider: "dialog/DialogProvider",
  AboutDialog: "dialog/AboutDialog",
  LrcMetadataDialog: "dialog/LrcMetadataDialog",

  Tooltip: "common/Tooltip",
  TextContextMenu: "common/TextContextMenu",
  UndoRedo: "common/UndoRedo",
  LineNumberedTextarea: "common/LineNumberedTextarea",
};

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;

  content = content.replace(/from\s+['"]\.\/([^'"]+)['"]/g, (match, p1) => {
    const componentName = p1.replace(".tsx", "").replace(".ts", "");
    if (componentMap[componentName]) {
      changed = true;
      return `from '@/components/${componentMap[componentName]}'`;
    }
    return match; // try it next
  });

  content = content.replace(/from\s+['"]\.\.\/components\/([^'"]+)['"]/g, (match, p1) => {
    const componentName = p1.replace(".tsx", "").replace(".ts", "");
    if (componentMap[componentName]) {
      changed = true;
      return `from '@/components/${componentMap[componentName]}'`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(file, content, "utf8");
    console.log("Fixed:", file);
  }
});
