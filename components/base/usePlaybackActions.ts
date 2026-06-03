import { useEditor } from "@/components/base/EditorProvider";
import { useCallback, useEffect, useRef, useState } from "react";

export function usePlaybackActions() {
  const {
    file,
    playerRef,
    duration,
    isPlaying,
    playbackRate,
    setPlaybackRate,
    lines,
    paragraphStarts,
    metadata,
  } = useEditor();

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [syncCurrTime, setSyncCurrTime] = useState(0);

  // [LINUX WORKAROUND] WebKitGTK 的 MPRIS D-Bus 介面在高頻 setPositionState 呼叫下會 crash，
  // 在 Linux Tauri 環境下完全停用 Media Session，避免 WebKitWebProcess 崩潰。
  const isLinuxTauri =
    typeof window !== "undefined" &&
    !!(window as any).__TAURI__ &&
    navigator.userAgent.toLowerCase().includes("linux");

  useEffect(() => {
    let id: number;
    let lastTime = 0;
    const loop = (timestamp: number) => {
      if (timestamp - lastTime > 66) {
        if (playerRef.current) setSyncCurrTime(playerRef.current.currentTime);
        lastTime = timestamp;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playerRef]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, playerRef]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.playbackRate !== playbackRate) {
      playerRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, playerRef]);

  const togglePlay = useCallback(() => {
    if (playerRef.current) {
      if (isPlaying) playerRef.current.pause();
      else playerRef.current.play();
    }
  }, [isPlaying, playerRef]);

  const stopPlay = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.currentTime = 0;
    }
  }, [playerRef]);

  const seekBy = useCallback(
    (sec: number) => {
      if (playerRef.current) {
        playerRef.current.currentTime = Math.max(0, playerRef.current.currentTime + sec);
      }
    },
    [playerRef],
  );

  const jumpToBeginning = useCallback(() => {
    if (playerRef.current) playerRef.current.currentTime = 0;
  }, [playerRef]);

  const jumpToNextSegment = useCallback(() => {
    if (!playerRef.current) return;
    const curr = playerRef.current.currentTime;
    for (let i = 0; i < lines.length; i++) {
      if (paragraphStarts[i] && lines[i].start !== null && lines[i].start! > curr + 1.0) {
        playerRef.current.currentTime = Math.max(0, lines[i].start! - 5.5);
        break;
      }
    }
  }, [lines, paragraphStarts, playerRef]);

  // ── Media Session：位置狀態節流更新 ────────────────────────────────
  const lastPositionUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (isLinuxTauri) return;

    if (duration > 0 && isFinite(duration)) {
      const now = performance.now();
      if (now - lastPositionUpdateRef.current < 1000) return;
      lastPositionUpdateRef.current = now;
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position: Math.min(syncCurrTime, duration),
        });
      } catch (e) {}
    }
  }, [syncCurrTime, duration, playbackRate, isLinuxTauri]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (isLinuxTauri) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata?.title || file?.name || "Unknown Track",
      artist: metadata?.artist || "",
      album: metadata?.album || "",
      artwork: metadata?.picture ? [{ src: metadata.picture, type: metadata.format }] : [],
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("stop", () => stopPlay());
    navigator.mediaSession.setActionHandler("seekbackward", (details) =>
      seekBy(-(details.seekOffset || 5)),
    );
    navigator.mediaSession.setActionHandler("seekforward", (details) =>
      seekBy(details.seekOffset || 5),
    );
    navigator.mediaSession.setActionHandler("previoustrack", jumpToBeginning);
    navigator.mediaSession.setActionHandler("nexttrack", jumpToNextSegment);
    try {
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined && playerRef.current) {
          playerRef.current.currentTime = details.seekTime;
        }
      });
    } catch (e) {}

    try {
      // @ts-ignore
      navigator.mediaSession.setActionHandler("playbackratechange" as any, (details: any) => {
        if (details.playbackRate) setPlaybackRate(details.playbackRate);
      });
    } catch (e) {}

    try {
      // @ts-ignore
      navigator.mediaSession.setActionHandler("setrepeatmode", null);
    } catch (e) {}
  }, [
    metadata,
    file,
    lines,
    paragraphStarts,
    isLinuxTauri,
    isPlaying,
    togglePlay,
    stopPlay,
    seekBy,
    jumpToBeginning,
    jumpToNextSegment,
    setPlaybackRate,
    playerRef,
  ]);

  return {
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    syncCurrTime,
    togglePlay,
    stopPlay,
    seekBy,
    jumpToBeginning,
    jumpToNextSegment,
  };
}
