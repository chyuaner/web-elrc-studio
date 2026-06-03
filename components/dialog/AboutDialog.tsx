"use client";
import { ExternalLink, Heart, ShieldCheck } from "lucide-react";
import { BaseDialog } from "./BaseDialog";

export function AboutDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title="關於 Enhanced LRC Studio"
      maxWidthClass="max-w-2xl"
      footer={
        <button
          onClick={onClose}
          className="px-6 py-2 bg-[var(--app-bg-hover)] hover:bg-[var(--app-border-base)] text-[var(--app-text-primary)] text-xs font-semibold rounded transition-colors"
        >
          關閉
        </button>
      }
    >
      <div className="text-sm text-[var(--app-text-secondary)] leading-relaxed space-y-4">
        <p className="flex items-center gap-2 text-[var(--app-text-primary)] text-base">
          <strong>作者：</strong> Yuan Chiu
          <a
            href="https://yuaner.tw"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--app-accent)] hover:underline inline-flex items-center gap-1 font-semibold"
          >
            https://yuaner.tw <ExternalLink size={14} />
          </a>
        </p>

        <p className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium pb-2 border-b border-[var(--app-border-base)]">
          <ShieldCheck size={18} /> 本專案採用 CC BY-NC-SA 4.0 授權
        </p>

        <div className="bg-[var(--app-bg-hover)] p-5 rounded-md space-y-3 border border-[var(--app-border-light)] relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Heart size={80} />
          </div>

          <h3 className="font-bold text-[var(--app-text-primary)] text-base border-b border-[var(--app-border-base)] pb-2 mb-3">
            📢 開發初衷與授權宣告
          </h3>

          <div className="space-y-4">
            <p className="leading-relaxed">
              最初製作這個專案，是為了解決自己編輯動態逐字歌詞的需求，但是卻缺乏專一且純粹的編輯器，甚至有些線上
              SaaS 服務甚至利用這極為單純的需求收取高昂的費用。
              <br />
              <br />
              因此，我決定重新打造這個純粹專注於「編輯與時間軸對齊」的工具。本站
              <strong>不會提供 AI 自動生成歌詞或自動對齊時間戳</strong>，也
              <strong>不會提供多曲目管理</strong>
              ，完全回歸手工與精準。這不僅是我的個人自用工具，我也將它免費開放給大眾使用。
            </p>

            <p className="leading-relaxed">
              <strong>聲明：</strong> 本專案大部分程式碼是由 AI (Gemini / AI Studio / Cursor)
              輔助生成，但我仍然投入了大量的心力在「需求規劃、UX
              設計、互動邏輯與功能調校」上。本著「取之於開源，用之於開源」的精神，本專案採用{" "}
              <strong>CC BY-NC-SA 4.0</strong> 授權。
            </p>

            <p className="leading-relaxed bg-red-500/10 border-l-4 border-red-500 p-3 rounded-r text-[var(--app-text-primary)]">
              <strong>反對商業化營利：</strong>{" "}
              為了保障專案的純粹與開放，我強烈反對任何低成本的商業化收割行為。禁止任何人將本專案的原始碼直接打包、閉源，或將其轉換成收費的
              SaaS (軟體即服務) 向大眾牟利。
            </p>

            <p className="leading-relaxed bg-blue-500/10 border-l-4 border-blue-500 p-3 rounded-r text-[var(--app-text-primary)]">
              <strong>歡迎用於實務商業應用需求 (致唱片與影片製作產業)：</strong>{" "}
              如果你是將這個工具應用於你的專業商業製作流程中（例如：唱片公司、工作室用來製作 KTV 或
              MV 歌曲的字幕），我<strong>非常歡迎</strong>
              。若您有這類的實務應用，歡迎與我聯絡，我會很高興這套工具對您的工作有實際幫助。
            </p>
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}
