"use client";

import { useEditor } from "@/components/base/EditorProvider";
import { LrcMetadataEditor } from "@/components/panel/LrcMetadataEditor";
import { useI18n } from "@/hooks/useI18n";
import { useEffect, useRef, useState } from "react";

export function LeftPanelInfo() {
  const { metadata } = useEditor();
  const i18n = useI18n();
  const [activeTab, setActiveTab] = useState<"instructions" | "metadata" | "lrcMetadata">(
    metadata ? "metadata" : "instructions",
  );
  const [pictureIndex, setPictureIndex] = useState(0);

  // Switch to metadata tab when a file is loaded for the first time
  const prevMetadataRef = useRef(metadata);
  useEffect(() => {
    if (metadata && !prevMetadataRef.current) {
      setActiveTab("metadata");
    }
    prevMetadataRef.current = metadata;
  }, [metadata]);

  // Reset index when metadata changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPictureIndex(0);
  }, [metadata]);

  const pictures = metadata?.pictures?.length
    ? metadata.pictures
    : metadata?.picture
      ? [metadata.picture]
      : [];
  const currentPicture = pictures[pictureIndex];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--app-bg-panel-alt)]">
      <div className="flex border-b border-[var(--app-border-base)] shrink-0 bg-[var(--app-bg-base)]">
        <button
          onClick={() => setActiveTab("metadata")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 hover:bg-[var(--app-bg-hover)] transition-colors ${activeTab === "metadata" ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"}`}
        >
          {i18n.tabMetadata}
        </button>
        <button
          onClick={() => setActiveTab("lrcMetadata")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 hover:bg-[var(--app-bg-hover)] transition-colors ${activeTab === "lrcMetadata" ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"}`}
        >
          LRC屬性
        </button>
        <button
          onClick={() => setActiveTab("instructions")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 hover:bg-[var(--app-bg-hover)] transition-colors ${activeTab === "instructions" ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"}`}
        >
          {i18n.tabInstructions}
        </button>
      </div>

      <div
        className={`flex-1 overflow-y-auto custom-scrollbar text-xs text-[var(--app-text-muted)] space-y-6 select-text flex flex-col ${activeTab === "lrcMetadata" ? "" : "p-6"}`}
      >
        {activeTab === "lrcMetadata" ? (
          <LrcMetadataEditor />
        ) : activeTab === "instructions" ? (
          <>
            <div>
              <h3 className="font-bold text-[var(--app-text-secondary)] uppercase tracking-widest text-[10px] mb-3 border-b border-[var(--app-border-base)] pb-1">
                {i18n.howToSyncTitle}
              </h3>
              <ul className="list-disc pl-4 space-y-2">
                <li>
                  <strong className="text-[var(--app-text-secondary)]">{i18n.step1}</strong>{" "}
                  {i18n.step1Text}
                </li>
                <li>
                  <strong className="text-[var(--app-text-secondary)]">{i18n.step2}</strong>{" "}
                  {i18n.step2Text}
                </li>
                <li>
                  <strong className="text-[var(--app-text-secondary)]">{i18n.step3}</strong>{" "}
                  {i18n.step3Text}{" "}
                  <span className="text-[var(--app-accent)]">{i18n.step3SyncEditor}</span>
                  {i18n.step3Text2}
                </li>
                <li>
                  <strong className="text-[var(--app-text-secondary)]">{i18n.step4}</strong>{" "}
                  {i18n.step4Text1}{" "}
                  <kbd className="bg-[var(--app-border-base)] text-[var(--app-accent)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)] mx-1">
                    {i18n.step4Space}
                  </kbd>{" "}
                  {i18n.step4Text2}
                </li>
                <li>
                  <strong className="text-[var(--app-text-secondary)]">{i18n.step5}</strong>{" "}
                  {i18n.step5Text}
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[var(--app-text-secondary)] uppercase tracking-widest text-[10px] mb-3 border-b border-[var(--app-border-base)] pb-1">
                {i18n.keyboardShortcutsTitle}
              </h3>
              <table className="w-full text-left border-collapse">
                <tbody>
                  <tr className="border-b border-[var(--app-border-base)]/50">
                    <td className="py-2 pr-2">{i18n.undoLabel}</td>
                    <td className="py-2 text-right">
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)]">
                        Ctrl/Cmd + Z
                      </kbd>
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--app-border-base)]/50">
                    <td className="py-2 pr-2">{i18n.redoLabel}</td>
                    <td className="py-2 text-right">
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)]">
                        Ctrl/Cmd + Y
                      </kbd>{" "}
                      /{" "}
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)]">
                        Cmd + Shift + Z
                      </kbd>
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--app-border-base)]/50">
                    <td className="py-2 pr-2">{i18n.playPauseLabel}</td>
                    <td className="py-2 text-right">
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)]">
                        P
                      </kbd>
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--app-border-base)]/50">
                    <td className="py-2 pr-2">{i18n.seekBackwardLabel}</td>
                    <td className="py-2 text-right">
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)]">
                        ←
                      </kbd>
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--app-border-base)]/50">
                    <td className="py-2 pr-2">{i18n.seekForwardLabel}</td>
                    <td className="py-2 text-right">
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)]">
                        →
                      </kbd>
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--app-border-base)]/50">
                    <td className="py-2 pr-2">{i18n.skipToLabel}</td>
                    <td className="py-2 text-right">
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)]">
                        0
                      </kbd>{" "}
                      -{" "}
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-border-light)]">
                        9
                      </kbd>
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--app-border-base)]/50">
                    <td className="py-2 pr-2">{i18n.stampLabel}</td>
                    <td className="py-2 text-right">
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-accent)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-accent)]/50">
                        {i18n.step4Space}
                      </kbd>
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--app-border-base)]/50">
                    <td className="py-2 pr-2">
                      {i18n.advanceLineLabel}{" "}
                      <span className="opacity-50">{i18n.advanceLineSub}</span>
                    </td>
                    <td className="py-2 text-right">
                      <kbd className="bg-[var(--app-border-base)] text-[var(--app-accent)] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--app-accent)]/50">
                        M
                      </kbd>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="space-y-4 font-mono text-[11px]">
            {metadata ? (
              <div className="space-y-2">
                {currentPicture && (
                  <div className="flex flex-col mb-4">
                    <div className="w-full aspect-square rounded border border-[var(--app-border-base)] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentPicture}
                        alt="Cover"
                        className="w-full h-full object-cover"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    </div>
                    {pictures.length > 1 && (
                      <div className="flex items-center justify-between mt-2 px-1">
                        <button
                          disabled={pictureIndex === 0}
                          onClick={() => setPictureIndex((p) => p - 1)}
                          className="px-2 py-0.5 bg-[var(--app-bg-hover)] border border-[var(--app-border-base)] rounded text-[10px] disabled:opacity-30"
                        >
                          &lt; Prev
                        </button>
                        <span className="text-[10px]">
                          {pictureIndex + 1} / {pictures.length}
                        </span>
                        <button
                          disabled={pictureIndex === pictures.length - 1}
                          onClick={() => setPictureIndex((p) => p + 1)}
                          className="px-2 py-0.5 bg-[var(--app-bg-hover)] border border-[var(--app-border-base)] rounded text-[10px] disabled:opacity-30"
                        >
                          Next &gt;
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <p>
                  <span className="text-[var(--app-text-secondary)]">{i18n.titleInfo}:</span>{" "}
                  {metadata.title || "Unknown"}
                </p>
                <p>
                  <span className="text-[var(--app-text-secondary)]">{i18n.artistInfo}:</span>{" "}
                  {metadata.artist || "Unknown"}
                </p>
                <p>
                  <span className="text-[var(--app-text-secondary)]">{i18n.albumInfo}:</span>{" "}
                  {metadata.album || "Unknown"}
                </p>
                <p>
                  <span className="text-[var(--app-text-secondary)]">{i18n.yearInfo}:</span>{" "}
                  {metadata.year || "Unknown"}
                </p>
                <p>
                  <span className="text-[var(--app-text-secondary)]">{i18n.trackInfo}:</span>{" "}
                  {metadata.track || "Unknown"}
                </p>
                {metadata.comment && (
                  <p>
                    <span className="text-[var(--app-text-secondary)]">{i18n.commentInfo}:</span>{" "}
                    <span className="italic">{metadata.comment}</span>
                  </p>
                )}

                {metadata.rawTags && (
                  <div className="mt-4 pt-4 border-t border-[var(--app-border-base)] space-y-2">
                    <h4 className="font-bold text-[var(--app-text-secondary)] uppercase tracking-widest text-[10px] mb-2">
                      {i18n.otherTagsInfo}
                    </h4>
                    {Object.entries(metadata.rawTags).map(([k, v]) => {
                      const knownKeys = [
                        "title",
                        "artist",
                        "album",
                        "year",
                        "track",
                        "picture",
                        "pictures",
                        "comment",
                        "lyrics",
                      ];
                      if (knownKeys.includes(k.toLowerCase()) || k.toLowerCase().startsWith("©lyr"))
                        return null;

                      let displayVal = "";
                      if (typeof v === "string" || typeof v === "number") {
                        displayVal = String(v);
                      } else if (v && typeof v === "object") {
                        if (v.data && Array.isArray(v.data) && v.data.length > 100) {
                          displayVal = "[Binary Data]";
                        } else if (v.text || v.description) {
                          displayVal = String(v.text || v.description);
                        } else {
                          try {
                            displayVal = JSON.stringify(v);
                            if (displayVal.length > 200)
                              displayVal = displayVal.substring(0, 200) + "...";
                          } catch (e) {
                            displayVal = "[Object]";
                          }
                        }
                      }

                      if (!displayVal || displayVal === "{}" || displayVal === "[]") return null;

                      return (
                        <div key={k} className="break-all">
                          <span className="text-[var(--app-text-secondary)]">{k}:</span>{" "}
                          <span className="opacity-80">{displayVal}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="italic text-center mt-4">{i18n.noMetadata}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
