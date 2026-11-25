import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, RefreshCw, Search, Sparkles } from "lucide-react";
import {
  fetchAllAlphabetSamples,
  type DatasetSignSample,
} from "../services/huggingfaceDataset";
import { COMMON_SIGNS, type SignDictResult } from "../types";

interface AslDictionaryProps {
  dictQuery: string;
  setDictQuery: (q: string) => void;
  dictResult: SignDictResult | null;
  isDictLoading: boolean;
  dictError: string | null;
  onLookup: (word?: string) => void;
  onTestDatasetSample?: (sample: DatasetSignSample) => void;
}

export const AslDictionary: React.FC<AslDictionaryProps> = ({
  dictQuery,
  setDictQuery,
  dictResult,
  isDictLoading,
  dictError,
  onLookup,
  onTestDatasetSample,
}) => {
  const [samples, setSamples] = useState<DatasetSignSample[]>([]);
  const [isGridLoading, setIsGridLoading] = useState<boolean>(true);
  const [gridError, setGridError] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const loadDatasetGrid = async (forceRefresh = false) => {
    setIsGridLoading(true);
    setGridError(null);
    try {
      const data = await fetchAllAlphabetSamples(forceRefresh);
      setSamples(data);
    } catch (err) {
      setGridError(
        err instanceof Error
          ? err.message
          : "Could not load ASL alphabet dataset from Hugging Face."
      );
    } finally {
      setIsGridLoading(false);
    }
  };

  useEffect(() => {
    void loadDatasetGrid(false);
  }, []);

  const filteredSamples = useMemo(() => {
    const q = dictQuery.trim().toLowerCase();
    if (!q) return samples;
    const normalized = q.replace(/^letter\s+/, "").replace(/^label\s+/, "");
    return samples.filter(
      (item) =>
        item.letter.toLowerCase().includes(normalized) ||
        `letter ${item.letter.toLowerCase()}`.includes(q) ||
        String(item.label) === normalized
    );
  }, [samples, dictQuery]);

  const handleCardSelect = (sample: DatasetSignSample) => {
    setActiveLetter(sample.letter);
    onLookup(`Letter ${sample.letter}`);
  };

  return (
    <div className="space-y-8 anim" style={{ "--d": "0.04s" } as React.CSSProperties}>
      <div className="max-w-2xl mx-auto text-center space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            ASL Dictionary &amp; Visual Dataset
          </h2>
          <p className="text-sm text-[#c4c2c3] opacity-85">
            Filter the live A–Z dataset grid from Hugging Face or look up step-by-step ASL-LEX
            phonology for any sign.
          </p>
        </div>

        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            onLookup();
          }}
          className="flex flex-col sm:flex-row gap-2.5 max-w-xl mx-auto"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e8e]" />
            <input
              value={dictQuery}
              onChange={(e) => setDictQuery(e.target.value)}
              placeholder="Filter A–Z letter, label (0–25), or search any sign..."
              className="w-full pl-11 pr-4 py-3 rounded-full border border-white/15 bg-black/60 backdrop-blur-md text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
              id="dictionary-search-input"
            />
          </div>
          <button
            type="submit"
            disabled={isDictLoading}
            className="cta-glow shrink-0"
            id="dictionary-search-submit"
          >
            <span>{isDictLoading ? "Searching..." : "Lookup"}</span>
          </button>
        </form>

        <div className="flex flex-wrap gap-2 justify-center">
          {COMMON_SIGNS.slice(0, 8).map((sign) => (
            <button
              key={sign}
              type="button"
              onClick={() => onLookup(sign)}
              className="pill-dark-btn !py-1.5 !px-3.5 !text-xs"
            >
              {sign}
            </button>
          ))}
        </div>
      </div>

      {isDictLoading && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Sparkles className="w-6 h-6 text-white animate-spin" />
          <span className="text-xs text-[#c4c2c3]">Retrieving ASL-LEX entry...</span>
        </div>
      )}

      {dictError && !isDictLoading && (
        <div className="max-w-xl mx-auto p-4 rounded-2xl border border-red-500/30 bg-red-950/40 text-red-200 text-sm flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
          <p>{dictError}</p>
        </div>
      )}

      {dictResult && !isDictLoading && (
        <div className="max-w-3xl mx-auto glass-panel p-7 sm:p-8 space-y-6">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <h3 className="text-2xl font-semibold capitalize text-white">{dictResult.word}</h3>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-[#8e8e8e]">
                <span className="capitalize text-[#c4c2c3]">{dictResult.difficulty}</span>
                <span aria-hidden="true">·</span>
                <span>{dictResult.category}</span>
              </div>
            </div>

            <div className="px-4 py-2 bg-white/10 border border-white/15 text-white font-mono font-medium text-base rounded-2xl tracking-wide">
              {dictResult.aslGloss}
            </div>
          </div>

          <div className="h-px bg-white/10" />

          <div className="space-y-5 text-sm leading-relaxed">
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#8e8e8e] block">Sign Description</span>
              <p className="text-white/90">{dictResult.description}</p>
            </div>

            {dictResult.nonManualMarkers && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#8e8e8e] block">
                  Non-Manual Facial Signals
                </span>
                <p className="text-[#c4c2c3]">{dictResult.nonManualMarkers}</p>
              </div>
            )}

            {dictResult.usage && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#8e8e8e] block">ASL Syntax Layout</span>
                <div className="glass-subpanel p-3.5 font-mono text-xs text-white">
                  {dictResult.usage}
                </div>
              </div>
            )}

            {dictResult.tips && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#8e8e8e] block">Memory Tip</span>
                <div className="flex gap-2 text-[#c4c2c3] text-xs">
                  <Sparkles className="w-4 h-4 text-white shrink-0" />
                  <span>{dictResult.tips}</span>
                </div>
              </div>
            )}

            {dictResult.similarSigns && dictResult.similarSigns.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-medium text-[#8e8e8e] block">Related Signs</span>
                <div className="flex flex-wrap gap-2">
                  {dictResult.similarSigns.map((sig) => (
                    <button
                      key={sig}
                      type="button"
                      onClick={() => onLookup(sig)}
                      className="pill-dark-btn !py-1.5 !px-3.5 !text-xs"
                    >
                      {sig}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <section className="glass-panel p-6 sm:p-7 space-y-5" aria-label="ASL Alphabet Dataset Grid">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              ASL Fingerspelling Dataset (A–Z)
            </h3>
            <p className="text-xs text-[#8e8e8e] mt-0.5">
              Live samples from Hugging Face (`Marxulia/asl_sign_languages_alphabets_v03`), labels
              0–25 mapped to A–Z.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#c4c2c3] tabular-nums">
              {isGridLoading ? "Loading..." : `${filteredSamples.length} / ${samples.length} signs`}
            </span>
            <button
              type="button"
              onClick={() => void loadDatasetGrid(true)}
              disabled={isGridLoading}
              className="pill-dark-btn !py-1.5 !px-3 !text-xs"
              id="refresh-dataset-grid-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGridLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {gridError && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-950/40 text-red-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{gridError}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadDatasetGrid(true)}
              className="pill-dark-btn !py-1 !px-3 !text-xs shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {isGridLoading && samples.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
            {Array.from({ length: 14 }).map((_, idx) => (
              <div
                key={idx}
                className="glass-subpanel p-2.5 space-y-2 animate-pulse"
                aria-hidden="true"
              >
                <div className="aspect-square w-full rounded-xl bg-white/10" />
                <div className="h-3.5 w-12 rounded bg-white/10 mx-auto" />
              </div>
            ))}
          </div>
        ) : filteredSamples.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm text-[#c4c2c3]">
              No alphabet signs match &ldquo;{dictQuery}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setDictQuery("")}
              className="pill-dark-btn !py-1.5 !px-4 !text-xs"
            >
              Show All A–Z Signs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
            {filteredSamples.map((sample) => {
              const isSelected = activeLetter === sample.letter;
              return (
                <div
                  key={`${sample.label}-${sample.rowIdx}`}
                  className={`glass-subpanel p-2.5 flex flex-col gap-2 transition-all border ${
                    isSelected
                      ? "border-white/60 bg-white/10"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleCardSelect(sample)}
                    className="group text-left focus:outline-none cursor-pointer w-full"
                    title={`Look up ASL Letter ${sample.letter} (Label ${sample.label})`}
                    id={`dataset-card-${sample.letter}`}
                  >
                    <div className="aspect-square w-full rounded-xl overflow-hidden bg-black/70 border border-white/10">
                      <img
                        src={sample.imageSrc}
                        alt={`ASL fingerspelling sign for letter ${sample.letter}`}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex items-baseline justify-between mt-2 px-0.5">
                      <span className="text-base font-semibold text-white">{sample.letter}</span>
                      <span className="text-[11px] font-mono text-[#8e8e8e] tabular-nums">
                        #{sample.label}
                      </span>
                    </div>
                  </button>

                  {onTestDatasetSample && (
                    <button
                      type="button"
                      onClick={() => onTestDatasetSample(sample)}
                      className="w-full py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white hover:text-black text-[11px] font-medium text-[#e0e0e0] transition-colors cursor-pointer whitespace-nowrap"
                      id={`test-in-sign-${sample.letter}`}
                    >
                      Recognize
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
