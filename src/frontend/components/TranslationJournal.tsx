import React from "react";
import { Download, HandMetal, History, Mic, Share2, Trash2 } from "lucide-react";
import type { HistoryItem } from "../types";

interface TranslationJournalProps {
  history: HistoryItem[];
  historyFilter: "all" | "speech" | "sign";
  setHistoryFilter: (f: "all" | "speech" | "sign") => void;
  onDownload: () => void;
  onClear: () => void;
  onCopy: (text: string) => void;
}

export const TranslationJournal: React.FC<TranslationJournalProps> = ({
  history,
  historyFilter,
  setHistoryFilter,
  onDownload,
  onClear,
  onCopy,
}) => {
  const filteredHistory =
    historyFilter === "all" ? history : history.filter((h) => h.type === historyFilter);

  return (
    <div className="space-y-6 anim" style={{ "--d": "0.04s" } as React.CSSProperties}>
      <div className="glass-panel p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Session Translation Journal
          </h2>
          <p className="text-xs text-[#8e8e8e] mt-1">
            Local session timeline of reconstructed speech and translated signs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-full bg-[#28282a] border border-white/10">
            {(["all", "speech", "sign"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition-colors cursor-pointer ${
                  historyFilter === filter
                    ? "bg-white text-black"
                    : "text-[#c8c8c8] hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <>
              <button
                type="button"
                onClick={onDownload}
                className="pill-dark-btn !py-2 !px-3.5 !text-xs"
                id="export-history-btn"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={onClear}
                className="pill-dark-btn !p-2"
                title="Clear journal"
                aria-label="Clear journal"
                id="clear-history-btn"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
        {filteredHistory.map((item) => (
          <div
            key={item.id}
            className="glass-panel p-4 sm:p-5 flex gap-4 items-start group"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-white">
              {item.type === "speech" ? (
                <Mic className="w-4 h-4" />
              ) : (
                <HandMetal className="w-4 h-4" />
              )}
            </div>

            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#8e8e8e]">
                <span className="font-mono tabular-nums">{item.time}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize text-[#c4c2c3]">{item.type}</span>
              </div>

              {item.type === "speech" && item.raw && (
                <p className="text-xs italic text-[#8e8e8e] truncate">
                  Raw Input: &ldquo;{item.raw}&rdquo;
                </p>
              )}

              <p className="text-sm sm:text-base font-medium text-white">{item.fluent}</p>
            </div>

            <button
              type="button"
              onClick={() => onCopy(item.fluent)}
              className="pill-dark-btn !p-2 opacity-75 group-hover:opacity-100 shrink-0"
              title="Copy translation"
              aria-label="Copy translation"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {filteredHistory.length === 0 && (
          <div className="glass-panel py-16 px-6 flex flex-col items-center justify-center gap-3 text-center">
            <History className="w-8 h-8 text-[#8e8e8e]" />
            <div>
              <p className="text-sm font-medium text-white">No journal entries yet</p>
              <p className="text-xs text-[#8e8e8e] mt-1">
                Reconstruct speech or translate a sign clip to record entries here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
