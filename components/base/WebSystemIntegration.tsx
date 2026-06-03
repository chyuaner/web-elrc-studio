"use client";

import { AppCommands } from "@/lib/app-commands";
import { useEffect } from "react";

// ── Linux Tauri 全螢幕狀態追蹤 ──────────────────────────────────────
// Tauri 在 Linux 上進入全螢幕時，GTK HeaderBar 會被 Wayland/X11 隱藏。
// 此時必須恢復顯示 web 版 TopToolbar（--top-toolbar-display: flex），
// 退出全螢幕後再還原隱藏（--top-toolbar-display: none）。
export function WebSystemIntegration() {
  useEffect(() => {
    const isTauri = typeof window !== "undefined" && (window as any).__TAURI__;
    const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
    const isCapacitor = typeof window !== "undefined" && !!(window as any).Capacitor;
    const electronShell = (window as any).electronAPI?.shell;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";

    if (isCapacitor) {
      (window as any).isAndroidFullscreen = false;
    }

    if (isElectron && electronShell) {
      const root = document.documentElement;
      root.classList.add("electron-shell");
      if (electronShell.titlebarLeftPadding) {
        root.style.setProperty("--titlebar-left-padding", electronShell.titlebarLeftPadding);
      }
      if (electronShell.useCustomWindowControls) {
        root.style.setProperty("--titlebar-right-padding", "0px");
      } else if (electronShell.titlebarRightPadding) {
        root.style.setProperty("--titlebar-right-padding", electronShell.titlebarRightPadding);
      }
    }
    const isLinuxTauri = isTauri && ua.includes("linux");

    // ── Capacitor Status Bar Initialization ──
    if (isCapacitor) {
      console.log("!!! BUILD_SUCCESS_VER_2 !!! - Dynamic Height Active");
      (async () => {
        try {
          const { StatusBar } = await import("@capacitor/status-bar");
          await StatusBar.setOverlaysWebView({ overlay: true });

          // 動態從原生插件獲取精確的狀態列高度
          const { registerPlugin } = await import("@capacitor/core");
          const ThemeControl = registerPlugin<any>("ThemeControl");
          const result = await ThemeControl.getStatusBarHeight();

          if (result && result.height) {
            // 將原生抓到的高度動態寫入 CSS 變數
            document.documentElement.style.setProperty("--android-safe-top", `${result.height}px`);
            console.log(`Successfully set dynamic status bar height: ${result.height}px`);
          } else {
            document.documentElement.style.setProperty("--android-safe-top", "38px");
          }
        } catch (err) {
          console.warn("Initial Capacitor StatusBar overlay failed:", err);
          document.documentElement.style.setProperty("--android-safe-top", "38px");
        }
      })();
    }

    // Prevent tab focus on buttons globally to avoid confusion with keyboard shortcuts
    const updateTabIndexes = () => {
      document
        .querySelectorAll(
          'button, input[type="checkbox"], input[type="radio"], [role="switch"], [role="button"]',
        )
        .forEach((el) => {
          if (el.getAttribute("tabindex") !== "-1") {
            el.setAttribute("tabindex", "-1");
          }
        });
    };
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldUpdate = true;
          break;
        }
      }
      if (shouldUpdate) updateTabIndexes();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    updateTabIndexes();

    // ── toggleFullscreen：Electron / Tauri / Capacitor 使用原生視窗 API，瀏覽器使用 document API ──
    if (!AppCommands.toggleFullscreen) {
      if (isElectron) {
        AppCommands.toggleFullscreen = async () => {
          try {
            await (window as any).electronAPI.toggleFullscreen();
          } catch (err) {
            console.warn("Electron toggleFullscreen failed:", err);
          }
        };
      } else if (isTauri) {
        // Tauri 全螢幕是視窗層級，必須透過 Tauri window API 切換，
        // 不能用 document.requestFullscreen（那只影響 WebView 的 DOM 層）。
        // 使用 dynamic import @tauri-apps/api/window 確保 Tauri v2 API 路徑正確
        AppCommands.toggleFullscreen = async () => {
          try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            const win = getCurrentWindow();
            const isFs = await win.isFullscreen();
            await win.setFullscreen(!isFs);
          } catch (err) {
            console.warn("Tauri setFullscreen failed:", err);
          }
        };
      } else if (isCapacitor) {
        AppCommands.toggleFullscreen = async () => {
          try {
            const { registerPlugin } = await import("@capacitor/core");
            const ThemeControl = registerPlugin<any>("ThemeControl");
            const currentlyFs = !!(window as any).isAndroidFullscreen;
            const nextFs = !currentlyFs;
            await ThemeControl.setFullscreen({ fullscreen: nextFs });
            (window as any).isAndroidFullscreen = nextFs;

            // Dispatch event to update the UI fullscreen state detection
            window.dispatchEvent(new Event("resize"));
            window.dispatchEvent(
              new CustomEvent("androidfullscreenchange", { detail: { isFullscreen: nextFs } }),
            );
          } catch (err) {
            console.warn("Capacitor setFullscreen failed:", err);
          }
        };
      } else {
        AppCommands.toggleFullscreen = () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
              console.warn(`Error attempting to enable fullscreen: ${err.message}`);
            });
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen();
            }
          }
        };
      }
    }

    async function syncCapacitorStatusBar(color: string) {
      if (!isCapacitor) return;
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setOverlaysWebView({ overlay: true });

        const isDark = color === "#16191E" || document.documentElement.classList.contains("dark");
        await StatusBar.setStyle({
          style: isDark ? Style.Dark : Style.Light,
        });

        // Android Navigation Bar theme-color synchronization via the custom ThemeControl plugin
        const { registerPlugin } = await import("@capacitor/core");
        const ThemeControl = registerPlugin<any>("ThemeControl");
        await ThemeControl.setNavigationBarColor({ color: color });
      } catch (err) {
        console.warn("Failed to update Capacitor status/navigation bar:", err);
      }
    }

    function updateMetaThemeColor(color: string) {
      let themeColor = color;
      if (typeof window !== "undefined") {
        const cssVar = getComputedStyle(document.documentElement)
          .getPropertyValue("--app-bg-panel-alt")
          .trim();
        if (cssVar && /^#[0-9a-fA-F]{6}$/.test(cssVar)) {
          themeColor = cssVar;
        }
      }

      let metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.setAttribute("name", "theme-color");
        document.head.appendChild(metaThemeColor);
      }

      document.querySelectorAll('meta[name="theme-color"][media]').forEach((el) => el.remove());

      metaThemeColor.setAttribute("content", themeColor);

      if (isCapacitor) {
        syncCapacitorStatusBar(themeColor);
      }
    }

    // Initialize Theme Meta Color
    const root = document.documentElement;
    const isSystemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Initial sync
    let isCurrentlyDarkInit =
      root.classList.contains("dark") ||
      (!root.classList.contains("light") && isSystemDarkQuery.matches);
    const defaultFallback = isCurrentlyDarkInit ? "#16191E" : "#f0f2f5";
    setTimeout(() => {
      const cssVar = getComputedStyle(root).getPropertyValue("--app-bg-panel-alt").trim();
      updateMetaThemeColor(cssVar || defaultFallback);
    }, 0);

    if (isTauri) {
      (window as any).__TAURI__.core
        .invoke("set_gtk_theme", { theme: isCurrentlyDarkInit ? "dark" : "light" })
        .catch(() => {});
    }
    if (isElectron) {
      (window as any).electronAPI?.windowSetTheme?.(isCurrentlyDarkInit ? "dark" : "light");
    }

    // Also listen to system theme changes dynamically if no forced theme!
    isSystemDarkQuery.addEventListener("change", (e) => {
      if (!root.classList.contains("dark") && !root.classList.contains("light")) {
        setTimeout(() => {
          const cssVar = getComputedStyle(root).getPropertyValue("--app-bg-panel-alt").trim();
          updateMetaThemeColor(cssVar || (e.matches ? "#16191E" : "#f0f2f5"));
        }, 0);
        if (isTauri) {
          (window as any).__TAURI__.core
            .invoke("set_gtk_theme", { theme: e.matches ? "dark" : "light" })
            .catch(() => {});
        }
        if (isElectron) {
          (window as any).electronAPI?.windowSetTheme?.(e.matches ? "dark" : "light");
        }
      }
    });

    if (!AppCommands.toggleTheme) {
      AppCommands.toggleTheme = (forceTheme?: "dark" | "light") => {
        const isSystemDark = isSystemDarkQuery.matches;

        let isCurrentlyDark = false;
        if (root.classList.contains("dark")) isCurrentlyDark = true;
        else if (root.classList.contains("light")) isCurrentlyDark = false;
        else isCurrentlyDark = isSystemDark;

        let willBeDark = forceTheme ? forceTheme === "dark" : !isCurrentlyDark;

        if (willBeDark) {
          root.classList.remove("light");
          root.classList.add("dark");
          root.style.colorScheme = "dark";
          setTimeout(() => {
            const cssVar = getComputedStyle(root).getPropertyValue("--app-bg-panel-alt").trim();
            updateMetaThemeColor(cssVar || "#16191E");
          }, 0);
          if (isTauri) {
            (window as any).__TAURI__.core
              .invoke("set_gtk_theme", { theme: "dark" })
              .catch(() => {});
          }
          if (isElectron) {
            (window as any).electronAPI?.windowSetTheme?.("dark");
          }
        } else {
          root.classList.remove("dark");
          root.classList.add("light");
          root.style.colorScheme = "light";
          setTimeout(() => {
            const cssVar = getComputedStyle(root).getPropertyValue("--app-bg-panel-alt").trim();
            updateMetaThemeColor(cssVar || "#f0f2f5");
          }, 0);
          if (isTauri) {
            (window as any).__TAURI__.core
              .invoke("set_gtk_theme", { theme: "light" })
              .catch(() => {});
          }
          if (isElectron) {
            (window as any).electronAPI?.windowSetTheme?.("light");
          }
        }
      };
    }

    // ── Linux Tauri 全螢幕狀態監聽 ────────────────────────────────────
    // Tauri v2 沒有專屬的 fullscreen window event，改用 tauri://resize 事件
    // 觸發後呼叫 isFullscreen() 查詢當前狀態（Tauri 官方建議做法）。
    // 進入全螢幕時：GTK HeaderBar 被系統隱藏 → 顯示 web TopToolbar
    // 離開全螢幕時：GTK HeaderBar 恢復顯示 → 隱藏 web TopToolbar
    let unlistenResize: (() => void) | null = null;
    if (isLinuxTauri) {
      (async () => {
        try {
          const tauri = (window as any).__TAURI__;
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          // tauri://resize 會在視窗大小任意變化（含進出全螢幕）時觸發
          unlistenResize = await tauri.event.listen("tauri://resize", async () => {
            try {
              const isFs = await getCurrentWindow().isFullscreen();
              document.documentElement.style.setProperty(
                "--top-toolbar-display",
                isFs ? "flex" : "none",
              );
            } catch (_) {}
          });
        } catch (err) {
          console.warn("Failed to listen for Tauri resize events:", err);
        }
      })();
    }

    return () => {
      observer.disconnect();
      if (unlistenResize) {
        try {
          unlistenResize();
        } catch (_) {}
      }
    };
  }, []);

  return null;
}
