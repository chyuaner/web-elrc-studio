import { useEditor } from "@/components/base/EditorProvider";
import { useDialogs } from "@/components/dialog/DialogProvider";
import { useI18n } from "@/hooks/useI18n";
import { exportLrc, exportSrt, parseRawLyrics } from "@/lib/lyric-utils";
import { extractFlacMetadata } from "@/lib/media-utils";
import { useCallback } from "react";

export function useFileActions() {
  const {
    lines,
    resetHistory,
    setFile,
    setMetadata,
    setAudioSpecs,
    setIsPlaying,
    playerRef,
    setDuration,
    setPlaybackRate,
    setLyricFileName,
    setLyricFile,
    lyricFile,
    setLrcMetadata,
    lrcMetadata,
    duration,
    file,
    lyricFileName,
    audioFileName,
    commitLines,
    autoLoadLyrics,
    autoLoadMedia,
    showToast,
  } = useEditor();
  const dialogs = useDialogs();
  const i18n = useI18n();

  const getFilePath = (f: any) => {
    if (!f) return null;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.getPathForFile) {
      return electronAPI.getPathForFile(f) || f.path;
    }
    return f.path;
  };

  const processAudioFile = useCallback(
    async (f: File, skipAutoLoadLyrics: boolean = false) => {
      setIsPlaying(false);
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.currentTime = 0;
      }
      setDuration(0);
      setPlaybackRate(1.0);
      setFile(f);

      const checkAndLoadSiblingLrc = async (audioPath: string) => {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI || skipAutoLoadLyrics) return false;
        try {
          const parsed = await electronAPI.pathParse(audioPath);
          const lrcPath = await electronAPI.pathJoin(parsed.dir, parsed.name + ".lrc");
          if (await electronAPI.fsExists(lrcPath)) {
            if (lines.length > 0) {
              const confirmed = await dialogs.confirm(
                "載入新的歌詞檔案將會覆蓋目前的歌詞。確定要繼續嗎？",
              );
              if (!confirmed) return false;
            }
            const currentLyricPath = getFilePath(lyricFile);
            if (currentLyricPath === lrcPath) {
              return true;
            }
            const text = await electronAPI.fsReadFileText(lrcPath);
            const lrcFile = new File([text], parsed.name + ".lrc", {
              type: "text/plain",
            });
            Object.defineProperty(lrcFile, "path", { value: lrcPath });
            setLyricFile(lrcFile);
            setLyricFileName(lrcFile.name);
            const parsedLrc = parseRawLyrics(text);
            resetHistory(parsedLrc.lines, parsedLrc.metadata);
            showToast(`已從自動載入同名檔案 "${lrcFile.name}" 載入歌詞`);
            return true;
          }
        } catch (e) {
          console.error(e);
        }
        return false;
      };

      import("music-metadata")
        .then(async (mm) => {
          try {
            const parsedMetadata = await mm.parseBlob(f);
            setAudioSpecs({
              format: parsedMetadata.format?.container || f.name.split(".").pop()?.toUpperCase(),
              bitrate: parsedMetadata.format?.bitrate
                ? Math.round(parsedMetadata.format.bitrate / 1000).toString()
                : undefined,
              sampleRate: parsedMetadata.format?.sampleRate?.toString(),
              bitsPerSample: parsedMetadata.format?.bitsPerSample?.toString(),
            });
          } catch (e) {
            setAudioSpecs({ format: f.name.split(".").pop()?.toUpperCase() });
          }
        })
        .catch(() => {
          setAudioSpecs({ format: f.name.split(".").pop()?.toUpperCase() });
        });

      if (f.name.toLowerCase().endsWith(".flac") && typeof window !== "undefined") {
        try {
          const slice = f.slice(0, 20 * 1024 * 1024);
          const arrayBuffer = await slice.arrayBuffer();
          const { tags, covers } = extractFlacMetadata(arrayBuffer);
          let foundLyrics =
            tags.get("LYRICS") || tags.get("UNSYNCEDLYRICS") || tags.get("UNSYNCED LYRICS");

          if (!foundLyrics) {
            for (const [key, value] of tags.entries()) {
              if (key === "LYRICS" || key.startsWith("LYRICS:") || key.startsWith("©LYR")) {
                foundLyrics = value;
                break;
              }
            }
          }

          if (foundLyrics || tags.size > 0 || covers.length > 0) {
            setMetadata({
              title: tags.get("TITLE"),
              artist: tags.get("ARTIST"),
              album: tags.get("ALBUM"),
              year: tags.get("DATE"),
              track: tags.get("TRACKNUMBER"),
              lyric: foundLyrics,
              picture: covers.length > 0 ? covers[0].url : null,
              pictures: covers.map((c) => c.url),
              rawTags: Object.fromEntries(tags),
            });
            if (foundLyrics && autoLoadLyrics && !skipAutoLoadLyrics) {
              if (lines.length > 0) {
                const confirmed = await dialogs.confirm(
                  "載入新的歌詞檔案將會覆蓋目前的歌詞。確定要繼續嗎？",
                );
                if (!confirmed) return;
              }
              setLyricFileName("Embedded Tag");
              const parsed = parseRawLyrics(foundLyrics);
              resetHistory(parsed.lines, parsed.metadata);
              showToast('已從 "Embedded Tag" 載入歌詞');
            } else if (!foundLyrics && autoLoadLyrics && !skipAutoLoadLyrics && getFilePath(f)) {
              await checkAndLoadSiblingLrc(getFilePath(f));
            }
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (typeof window !== "undefined") {
        const jsmediatags = require("jsmediatags");
        jsmediatags.read(f, {
          onSuccess: async function (tag: any) {
            const { title, artist, album, year, comment, track, picture } = tag.tags;

            let picUrl = null;
            if (picture) {
              try {
                const base64String = picture.data.reduce(
                  (acc: string, byte: number) => acc + String.fromCharCode(byte),
                  "",
                );
                picUrl = `data:${picture.format};base64,${window.btoa(base64String)}`;
              } catch (e) {}
            }

            let foundLyrics: any =
              tag.tags.USLT?.lyrics ||
              tag.tags.SYLT?.lyrics ||
              tag.tags.LYRICS ||
              tag.tags.lyrics ||
              tag.tags["©lyr"] ||
              tag.tags.COMMENT?.text ||
              tag.tags.comment?.text;

            if (!foundLyrics) {
              for (const key of Object.keys(tag.tags)) {
                const k = key.toLowerCase();
                if (k === "lyrics" || k.startsWith("lyrics:") || k.startsWith("©lyr")) {
                  foundLyrics =
                    typeof tag.tags[key] === "string"
                      ? tag.tags[key]
                      : tag.tags[key]?.data || tag.tags[key]?.text;
                  if (foundLyrics) break;
                }
              }
            }

            if (foundLyrics && typeof foundLyrics !== "string" && foundLyrics.data) {
              foundLyrics = foundLyrics.data;
            }
            if (typeof foundLyrics !== "string") {
              foundLyrics = undefined;
            }

            setMetadata({
              title,
              artist,
              album,
              year,
              track,
              comment: comment?.text || (typeof comment === "string" ? comment : undefined),
              format: picture?.format,
              picture: picUrl,
              lyric: foundLyrics,
              rawTags: tag.tags,
            });

            if (foundLyrics && autoLoadLyrics && !skipAutoLoadLyrics) {
              if (lines.length > 0) {
                const confirmed = await dialogs.confirm(
                  "載入新的歌詞檔案將會覆蓋目前的歌詞。確定要繼續嗎？",
                );
                if (!confirmed) return;
              }
              setLyricFileName("Embedded Tag");
              const parsed = parseRawLyrics(foundLyrics);
              resetHistory(parsed.lines, parsed.metadata);
              showToast('已從 "Embedded Tag" 載入歌詞');
            } else if (!foundLyrics && autoLoadLyrics && !skipAutoLoadLyrics && getFilePath(f)) {
              await checkAndLoadSiblingLrc(getFilePath(f));
            }
          },
          onError: async function (error: any) {
            console.log("No ID3 tags or error", error);
            setMetadata(null);
            if (autoLoadLyrics && !skipAutoLoadLyrics && getFilePath(f)) {
              await checkAndLoadSiblingLrc(getFilePath(f));
            }
          },
        });
      }
    },
    [
      resetHistory,
      setFile,
      setLyricFileName,
      setLyricFile,
      lyricFile,
      setMetadata,
      setAudioSpecs,
      setIsPlaying,
      playerRef,
      setDuration,
      setPlaybackRate,
      autoLoadLyrics,
      showToast,
      lines.length,
      dialogs,
    ],
  );

  const processLyricFile = useCallback(
    async (f: File) => {
      if (lines.length > 0) {
        const confirmed = await dialogs.confirm(
          "載入新的歌詞檔案將會覆蓋目前的歌詞。確定要繼續嗎？",
        );
        if (!confirmed) return;
      }
      setLyricFile(f);
      setLyricFileName(f.name);
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const text = evt.target?.result as string;
        const parsed = parseRawLyrics(text);
        resetHistory(parsed.lines, parsed.metadata);

        let mediaLoaded = false;
        let loadedMediaName = "";
        const filePath = getFilePath(f);
        if (autoLoadMedia && filePath) {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI) {
            try {
              const parsedPath = await electronAPI.pathParse(filePath);
              const exts = [".flac", ".mp3", ".m4a", ".wav", ".mp4"];
              for (const ext of exts) {
                const mediaPath = await electronAPI.pathJoin(parsedPath.dir, parsedPath.name + ext);
                if (await electronAPI.fsExists(mediaPath)) {
                  const currentMediaPath = getFilePath(file);
                  if (currentMediaPath === mediaPath) {
                    mediaLoaded = true;
                    loadedMediaName = file?.name || parsedPath.name + ext;
                    break;
                  }

                  const buffer = await electronAPI.fsReadFileBinary(mediaPath);
                  let mimeType = "audio/mpeg";
                  if (ext === ".flac") mimeType = "audio/flac";
                  else if (ext === ".m4a") mimeType = "audio/mp4";
                  else if (ext === ".wav") mimeType = "audio/wav";
                  else if (ext === ".mp4") mimeType = "video/mp4";

                  const blob = new Blob([buffer], { type: mimeType });
                  const mediaFile = new File([blob], parsedPath.name + ext, {
                    type: mimeType,
                  });
                  Object.defineProperty(mediaFile, "path", {
                    value: mediaPath,
                  });

                  await processAudioFile(mediaFile, true);
                  mediaLoaded = true;
                  loadedMediaName = mediaFile.name;
                  break;
                }
              }
            } catch (e) {
              console.error(e);
            }
          }
        }

        if (mediaLoaded) {
          showToast(`已自動載入媒體 "${loadedMediaName}"`);
        } else {
          showToast(`已從 "${f.name}" 載入歌詞`);
        }
      };
      reader.readAsText(f);
    },
    [
      lines.length,
      dialogs,
      resetHistory,
      setLyricFileName,
      setLyricFile,
      file,
      showToast,
      autoLoadMedia,
      processAudioFile,
    ],
  );

  const handleExport = useCallback(
    async (
      format: "standard" | "enhanced" | "word" | "simple" | "srt",
      saveType: "file" | "embedded" = "file",
      customTitle?: string,
    ) => {
      if (lines.length === 0) return;

      let lrcText = "";
      if (format === "srt") {
        lrcText = exportSrt(lines, duration);
      } else {
        lrcText = exportLrc(
          lines,
          lrcMetadata,
          format === "enhanced",
          format === "simple",
          false,
          undefined,
          true,
          format === "word",
        );
      }

      let defaultName = "lyrics.lrc";
      if (lyricFileName && lyricFileName !== "Embedded Tag" && lyricFileName !== "New Lyrics") {
        defaultName = lyricFileName;
      } else if (audioFileName) {
        defaultName = audioFileName.replace(/\.[^/.]+$/, "") + ".lrc";
      }

      if (format === "simple") {
        defaultName = defaultName.replace(/\.[^/.]+$/, "") + ".txt";
      } else if (format === "srt") {
        defaultName = defaultName.replace(/\.[^/.]+$/, "") + ".srt";
      }

      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.showSaveDialog && (saveType === "file" || saveType === "embedded")) {
        let defaultPath = defaultName;
        const mediaPath = getFilePath(file);
        if (mediaPath) {
          try {
            const parsed = await electronAPI.pathParse(mediaPath);
            defaultPath = await electronAPI.pathJoin(parsed.dir, defaultName);
          } catch (e) {
            console.error("Path parse/join failed", e);
          }
        }

        const filters = [];
        if (saveType === "embedded" && file) {
          const ext = file.name.substring(file.name.lastIndexOf(".") + 1).toLowerCase();
          filters.push({ name: "Media File", extensions: [ext] });
          defaultPath = defaultPath
            .replace(/\.lrc$/, "." + ext)
            .replace(/\.txt$/, "." + ext)
            .replace(/\.srt$/, "." + ext);
          if (!defaultPath.endsWith("." + ext)) {
            defaultPath = defaultName.replace(/\.[^/.]+$/, "") + "." + ext;
          }
        } else {
          if (format === "srt") {
            filters.push({ name: "SubRip Subtitle", extensions: ["srt"] });
          } else if (format === "simple") {
            filters.push({ name: "Plain Text", extensions: ["txt"] });
          } else {
            filters.push({ name: "LRC Lyric", extensions: ["lrc"] });
          }
        }
        filters.push({ name: "All Files", extensions: ["*"] });

        const result = await electronAPI.showSaveDialog({
          title: customTitle || i18n.saveLyric || "儲存檔案",
          defaultPath: defaultPath,
          filters: filters,
        });

        if (!result.canceled && result.filePath) {
          if (saveType === "embedded" && file) {
            try {
              const lowerName = file.name.toLowerCase();
              const arrayBuffer = await file.arrayBuffer();
              let blob: Blob;
              if (lowerName.endsWith(".flac")) {
                const { embedLyricsIntoFlac } = await import("@/lib/flac-utils");
                blob = embedLyricsIntoFlac(arrayBuffer, lrcText, format === "enhanced");
              } else {
                const { embedLyricsIntoM4a } = await import("@/lib/m4a-utils");
                blob = embedLyricsIntoM4a(arrayBuffer, lrcText, format === "enhanced");
              }
              const buffer = await blob.arrayBuffer();
              await electronAPI.fsWriteFileBinary(result.filePath, buffer);
              showToast(`${i18n.savedTo || "已儲存至 "}${result.filePath}`);
            } catch (e) {
              console.error("Embedding failed", e);
              dialogs.alert("嵌入歌詞失敗");
            }
          } else {
            await electronAPI.fsWriteFileText(result.filePath, lrcText);
            showToast(`${i18n.savedTo || "已儲存至 "}${result.filePath}`);
          }
          return;
        }
        if (result.canceled) return;
      }

      const isTauri = typeof window !== "undefined" && (window as any).__TAURI__;
      const isCapacitor = typeof window !== "undefined" && !!(window as any).Capacitor;
      if (isTauri) {
        try {
          if (saveType === "embedded" && file) {
            const lowerName = file.name.toLowerCase();
            if (
              lowerName.endsWith(".flac") ||
              lowerName.endsWith(".m4a") ||
              lowerName.endsWith(".mp4")
            ) {
              const arrayBuffer = await file.arrayBuffer();
              let blob: Blob;
              if (lowerName.endsWith(".flac")) {
                const { embedLyricsIntoFlac } = await import("@/lib/flac-utils");
                blob = embedLyricsIntoFlac(arrayBuffer, lrcText, format === "enhanced");
              } else {
                const { embedLyricsIntoM4a } = await import("@/lib/m4a-utils");
                blob = embedLyricsIntoM4a(arrayBuffer, lrcText, format === "enhanced");
              }
              const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
              await (window as any).__TAURI__.core.invoke("save_binary_dialog", {
                bytes,
                defaultName: file.name,
              });
            }
          } else {
            await (window as any).__TAURI__.core.invoke("save_lyrics_dialog", {
              lyricsText: lrcText,
              defaultName: defaultName,
              format: format,
            });
          }
        } catch (err) {
          console.error("Tauri save dialog failed", err);
        }
      } else if (isCapacitor) {
        try {
          const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
          const { Share } = await import("@capacitor/share");

          if (saveType === "embedded" && file) {
            const lowerName = file.name.toLowerCase();
            if (
              lowerName.endsWith(".flac") ||
              lowerName.endsWith(".m4a") ||
              lowerName.endsWith(".mp4")
            ) {
              const arrayBuffer = await file.arrayBuffer();
              let blob: Blob;
              if (lowerName.endsWith(".flac")) {
                const { embedLyricsIntoFlac } = await import("@/lib/flac-utils");
                blob = embedLyricsIntoFlac(arrayBuffer, lrcText, format === "enhanced");
              } else {
                const { embedLyricsIntoM4a } = await import("@/lib/m4a-utils");
                blob = embedLyricsIntoM4a(arrayBuffer, lrcText, format === "enhanced");
              }

              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = async () => {
                try {
                  const base64data = (reader.result as string).split(",")[1];
                  const writeResult = await Filesystem.writeFile({
                    path: file.name,
                    data: base64data,
                    directory: Directory.Cache,
                  });
                  await Share.share({
                    title: file.name,
                    url: writeResult.uri,
                  });
                } catch (e) {
                  console.error("Capacitor write/share embedded file failed", e);
                  alert("無法嵌入並儲存媒體檔案");
                }
              };
            }
          } else {
            const writeResult = await Filesystem.writeFile({
              path: defaultName,
              data: lrcText,
              directory: Directory.Cache,
              encoding: Encoding.UTF8,
            });
            await Share.share({
              title: defaultName,
              url: writeResult.uri,
            });
          }
        } catch (err) {
          console.error("Capacitor save/share failed", err);
          alert("儲存檔案失敗: " + (err as Error).message);
        }
      } else {
        if (saveType === "embedded" && file) {
          const lowerName = file.name.toLowerCase();
          if (
            lowerName.endsWith(".flac") ||
            lowerName.endsWith(".m4a") ||
            lowerName.endsWith(".mp4")
          ) {
            try {
              const arrayBuffer = await file.arrayBuffer();
              let blob: Blob;
              if (lowerName.endsWith(".flac")) {
                const { embedLyricsIntoFlac } = await import("@/lib/flac-utils");
                blob = embedLyricsIntoFlac(arrayBuffer, lrcText, format === "enhanced");
              } else {
                const { embedLyricsIntoM4a } = await import("@/lib/m4a-utils");
                blob = embedLyricsIntoM4a(arrayBuffer, lrcText, format === "enhanced");
              }

              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = file.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (e) {
              console.error(e);
              alert("Failed to embed lyrics into media file");
            }
            return;
          }
        }

        const blob = new Blob([lrcText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    [lines, lyricFileName, audioFileName, lrcMetadata, file, duration],
  );

  const doClearLyricsState = useCallback(() => {
    resetHistory([], {});
    setLyricFileName(null);
    setLyricFile(null);
  }, [resetHistory, setLyricFileName, setLyricFile]);

  const clearMedia = useCallback(async () => {
    if (audioFileName) {
      if (await dialogs.confirm("確定要清除目前的媒體檔案嗎？")) {
        setFile(null);
        setMetadata(null);
        setAudioSpecs(null);
        if (autoLoadLyrics) {
          doClearLyricsState();
        }
      }
    }
  }, [
    audioFileName,
    autoLoadLyrics,
    setFile,
    setMetadata,
    setAudioSpecs,
    dialogs,
    doClearLyricsState,
  ]);

  const clearLyrics = useCallback(async () => {
    if (lines.length > 0 || Object.keys(lrcMetadata).length > 0 || lyricFileName) {
      if (await dialogs.confirm("確定要清除目前的歌詞與屬性資訊嗎？")) {
        doClearLyricsState();
      }
    }
  }, [lines.length, lrcMetadata, lyricFileName, dialogs, doClearLyricsState]);

  const loadEmbeddedLyrics = useCallback(
    async (metadata: any) => {
      if (metadata?.lyric) {
        if (lines.length > 0) {
          const confirmed = await dialogs.confirm("載入內嵌歌詞將會覆蓋目前的歌詞。確定要繼續嗎？");
          if (!confirmed) return;
        }
        const parsed = parseRawLyrics(metadata.lyric);
        resetHistory(parsed.lines, parsed.metadata);
        setLyricFileName("Embedded Tag");
        setLyricFile(null);
        showToast('已從 "Embedded Tag" 載入歌詞');
      }
    },
    [lines.length, dialogs, resetHistory, setLyricFileName, setLyricFile, showToast],
  );

  const loadSiblingMediaForLyrics = useCallback(async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    if (!lyricFile) {
      dialogs.alert("請先載入歌詞檔案");
      return;
    }
    const lyricPath = getFilePath(lyricFile);
    if (lyricPath) {
      try {
        const parsedPath = await electronAPI.pathParse(lyricPath);
        const exts = [".flac", ".mp3", ".m4a", ".wav", ".mp4"];
        let mediaLoaded = false;
        let loadedMediaName = "";
        for (const ext of exts) {
          const mediaPath = await electronAPI.pathJoin(parsedPath.dir, parsedPath.name + ext);
          if (await electronAPI.fsExists(mediaPath)) {
            const currentMediaPath = getFilePath(file);
            if (currentMediaPath === mediaPath) {
              mediaLoaded = true;
              loadedMediaName = file?.name || parsedPath.name + ext;
              break;
            }

            const buffer = await electronAPI.fsReadFileBinary(mediaPath);
            let mimeType = "audio/mpeg";
            if (ext === ".flac") mimeType = "audio/flac";
            else if (ext === ".m4a") mimeType = "audio/mp4";
            else if (ext === ".wav") mimeType = "audio/wav";
            else if (ext === ".mp4") mimeType = "video/mp4";

            const blob = new Blob([buffer], { type: mimeType });
            const mediaFile = new File([blob], parsedPath.name + ext, {
              type: mimeType,
            });
            Object.defineProperty(mediaFile, "path", { value: mediaPath });

            await processAudioFile(mediaFile, true);
            mediaLoaded = true;
            loadedMediaName = mediaFile.name;
            break;
          }
        }
        if (mediaLoaded) {
          showToast(`已自動載入媒體 "${loadedMediaName}"`);
        } else {
          dialogs.alert("找不到與歌詞檔同名的媒體檔案 (.flac, .mp3, .m4a, .wav, .mp4)");
        }
      } catch (e) {
        console.error(e);
        dialogs.alert("載入媒體檔案時發生錯誤");
      }
    } else {
      dialogs.alert("無法取得目前歌詞檔的路徑");
    }
  }, [lyricFile, file, processAudioFile, dialogs, showToast]);

  return {
    processAudioFile,
    processLyricFile,
    handleExport,
    clearMedia,
    clearLyrics,
    loadEmbeddedLyrics,
    loadSiblingMediaForLyrics,
  };
}
