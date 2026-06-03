import { useEditor } from "@/components/base/EditorProvider";
import { BaseDialog } from "@/components/dialog/BaseDialog";
import { Merge, Settings2, Split } from "lucide-react";
import { useEffect, useState } from "react";

export function MultiSingerDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lrcMetadata, setLrcMetadata, commitLines, lines, showToast } = useEditor();
  const [bDef, setBDef] = useState("");
  const [rDef, setRDef] = useState("");
  const [pDef, setPDef] = useState("");
  const [gDef, setGDef] = useState("");
  const [tDef, setTDef] = useState("");

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBDef(lrcMetadata.kstyledef_B?.toString() || "男：");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRDef(lrcMetadata.kstyledef_R?.toString() || "女：");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPDef(lrcMetadata.kstyledef_P?.toString() || "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGDef(lrcMetadata.kstyledef_G?.toString() || "合：");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTDef(lrcMetadata.kstyledef_T?.toString() || "旁白：");
    }
  }, [isOpen, lrcMetadata]);

  const handleSaveDef = () => {
    const nextMeta = { ...lrcMetadata };
    if (bDef) nextMeta.kstyledef_B = bDef;
    else delete nextMeta.kstyledef_B;
    if (rDef) nextMeta.kstyledef_R = rDef;
    else delete nextMeta.kstyledef_R;
    if (pDef) nextMeta.kstyledef_P = pDef;
    else delete nextMeta.kstyledef_P;
    if (gDef) nextMeta.kstyledef_G = gDef;
    else delete nextMeta.kstyledef_G;
    if (tDef) nextMeta.kstyledef_T = tDef;
    else delete nextMeta.kstyledef_T;
    setLrcMetadata(nextMeta);
    showToast("已儲存對唱標籤定義 (kstyledef)");
  };

  const handleConvertToTags = () => {
    // Save definitions first
    handleSaveDef();

    const defs = [
      { key: "B", val: bDef },
      { key: "R", val: rDef },
      { key: "P", val: pDef },
      { key: "G", val: gDef },
      { key: "T", val: tDef },
    ].filter((d) => Boolean(d.val));

    if (defs.length === 0) {
      showToast("未設定任何判定字段");
      return;
    }

    commitLines((prev) => {
      const nextLines = [...prev];
      let changesCount = 0;

      for (let i = 0; i < nextLines.length; i++) {
        const line = { ...nextLines[i] };
        let words = [...line.words];

        let changedLine = false;

        for (const def of defs) {
          const pattern = def.val;

          // Check line raw or text (if words empty but line has raw text, we skip since we want word-level editing)
          if (words.length > 0) {
            const firstWordText = words[0].text;
            if (firstWordText.startsWith(pattern)) {
              words[0] = { ...words[0], text: firstWordText.substring(pattern.length) };
              line.style = def.key;
              changedLine = true;
            } else {
              // Word-level within the line
              for (let w = 1; w < words.length; w++) {
                if (words[w].text.startsWith(pattern)) {
                  words[w] = {
                    ...words[w],
                    text: words[w].text.substring(pattern.length),
                    style: def.key,
                  };
                  changedLine = true;
                }
              }
            }
          }
        }

        if (changedLine) {
          line.words = words;
          nextLines[i] = line;
          changesCount++;
        }
      }

      if (changesCount > 0) {
        showToast(`已將 ${changesCount} 處明文轉換為隱藏式標籤`);
      } else {
        showToast("未找到符合的明文字段");
      }

      return nextLines;
    }, "明文轉為隱藏式標籤");
  };

  const handleConvertFromTags = () => {
    const defs = [
      { key: "B", val: bDef },
      { key: "R", val: rDef },
      { key: "P", val: pDef },
      { key: "G", val: gDef },
      { key: "T", val: tDef },
    ];

    const getPrefix = (styleKey: string) => {
      const d = defs.find((d) => d.key === styleKey);
      return d ? d.val : "";
    };

    commitLines((prev) => {
      const nextLines = [...prev];
      let changesCount = 0;

      for (let i = 0; i < nextLines.length; i++) {
        const line = { ...nextLines[i] };
        let words = [...line.words];
        let changedLine = false;

        // Line-level style
        if (line.style) {
          const prefix = getPrefix(line.style);
          if (prefix && words.length > 0) {
            words[0] = { ...words[0], text: prefix + words[0].text };
            delete line.style;
            changedLine = true;
          }
        }

        // Word-level style
        for (let w = 0; w < words.length; w++) {
          if (words[w].style) {
            const prefix = getPrefix(words[w].style!);
            if (prefix) {
              words[w] = { ...words[w], text: prefix + words[w].text };
              delete words[w].style;
              changedLine = true;
            }
          }
        }

        if (changedLine) {
          line.words = words;
          nextLines[i] = line;
          changesCount++;
        }
      }

      if (changesCount > 0) {
        showToast(`已將 ${changesCount} 處隱藏標籤還原為明文字段`);
      } else {
        showToast("未找到隱藏式標籤");
      }

      return nextLines;
    }, "隱藏式標籤轉回明文字段");
  };

  return (
    <BaseDialog isOpen={isOpen} onClose={onClose} title="多人對唱設定" maxWidthClass="max-w-md">
      <div className="flex flex-col gap-5 p-1 text-sm text-[var(--app-text-primary)]">
        <div className="text-xs text-[var(--app-text-muted)] leading-relaxed space-y-2 mb-2">
          <p className="px-3 py-2 bg-[var(--app-bg-hover)] border border-[var(--app-border-base)] rounded text-[var(--app-text-secondary)] font-medium">
            💡
            本系統鼓勵以「隱藏式標籤」設計多人對唱（不污染歌詞文字本身）。如果您的歌詞本來就沒有歌手標記，建議直接在編輯區使用右鍵選單進行標記即可。
          </p>
          <p>
            此工具主要用於快速整理含有實體對唱標記（例如「男：」或「女：」）的外部歌詞。您可以定義這些文字，將其隱藏並轉化為內部顏色標記。
          </p>
        </div>

        <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
          <label className="text-right text-xs text-blue-500 font-bold">藍字 (通常為男)</label>
          <input
            type="text"
            className="w-full bg-[var(--app-bg-input)] border border-[var(--app-border-base)] rounded px-3 py-1.5 focus:border-[var(--app-accent)] focus:outline-none"
            placeholder="男："
            value={bDef}
            onChange={(e) => setBDef(e.target.value)}
          />

          <label className="text-right text-xs text-red-500 font-bold">紅字 (通常為女)</label>
          <input
            type="text"
            className="w-full bg-[var(--app-bg-input)] border border-[var(--app-border-base)] rounded px-3 py-1.5 focus:border-[var(--app-accent)] focus:outline-none"
            placeholder="女："
            value={rDef}
            onChange={(e) => setRDef(e.target.value)}
          />

          <label className="text-right text-xs text-purple-500 font-bold">紫字 (第三人)</label>
          <input
            type="text"
            className="w-full bg-[var(--app-bg-input)] border border-[var(--app-border-base)] rounded px-3 py-1.5 focus:border-[var(--app-accent)] focus:outline-none"
            placeholder="留空"
            value={pDef}
            onChange={(e) => setPDef(e.target.value)}
          />

          <label className="text-right text-xs text-green-500 font-bold">綠字 (合唱)</label>
          <input
            type="text"
            className="w-full bg-[var(--app-bg-input)] border border-[var(--app-border-base)] rounded px-3 py-1.5 focus:border-[var(--app-accent)] focus:outline-none"
            placeholder="合："
            value={gDef}
            onChange={(e) => setGDef(e.target.value)}
          />

          <label className="text-right text-xs text-gray-500 font-bold">灰字 (旁白或背景)</label>
          <input
            type="text"
            className="w-full bg-[var(--app-bg-input)] border border-[var(--app-border-base)] rounded px-3 py-1.5 focus:border-[var(--app-accent)] focus:outline-none"
            placeholder="旁白："
            value={tDef}
            onChange={(e) => setTDef(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveDef}
            className="flex-1 py-1.5 bg-[var(--app-bg-panel)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-base)] rounded flex justify-center items-center gap-1 transition-colors text-xs"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="font-semibold">僅儲存判定設定</span>
          </button>
        </div>

        <div className="h-px bg-[var(--app-border-base)] w-full block my-2" />

        <div className="flex flex-col gap-2">
          <button
            onClick={handleConvertToTags}
            className="w-full py-2 bg-[var(--app-accent)]/10 hover:bg-[var(--app-accent)]/20 text-[var(--app-accent)] border border-[var(--app-accent)]/30 rounded flex justify-center items-center gap-1 transition-colors text-xs font-bold"
          >
            <Split className="w-4 h-4" />
            <span>將明文轉為隱藏式對唱標籤</span>
          </button>
          <p className="text-xs text-[var(--app-text-muted)] text-center opacity-70 mb-2">
            （會移除歌詞中符合上方設定的文字，並將該句自動標上對唱顏色）
          </p>

          <button
            onClick={handleConvertFromTags}
            className="w-full py-2 bg-[var(--app-bg-panel)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-base)] rounded flex justify-center items-center gap-1 transition-colors text-xs text-[var(--app-text-secondary)]"
          >
            <Merge className="w-4 h-4" />
            <span>將隱藏式對唱標籤還原為明文</span>
          </button>
          <p className="text-xs text-[var(--app-text-muted)] text-center opacity-70">
            （依據上方設定將「男：」等文字重新加回歌詞中，然後取消對唱標記）
          </p>
        </div>
      </div>
    </BaseDialog>
  );
}
