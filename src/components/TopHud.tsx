import React, { useEffect, useRef, useState } from 'react';
import {
  Cog,
  Cpu,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getXpForNextLevel } from '../game/config';
import { formatCompactNumber } from '../game/economy';

interface TopHudProps {
  scrap: number;
  forgeCores: number;
  tankLevel: number;
  tankXp: number;
  isPaused: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  canFullscreen: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onRequestReset: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  scrap,
  forgeCores,
  tankLevel,
  tankXp,
  isPaused,
  isMuted,
  isFullscreen,
  canFullscreen,
  onTogglePause,
  onToggleMute,
  onToggleFullscreen,
  onRequestReset,
}) => {
  const xpNeeded = getXpForNextLevel(tankLevel);
  const xpPercent = Math.max(0, Math.min(100, (tankXp / Math.max(1, xpNeeded)) * 100));

  const prevScrapRef = useRef(scrap);
  const prevCoresRef = useRef(forgeCores);
  const [scrapPopKey, setScrapPopKey] = useState(0);
  const [coresPopKey, setCoresPopKey] = useState(0);

  useEffect(() => {
    if (scrap > prevScrapRef.current) {
      setScrapPopKey((k) => k + 1);
    }
    prevScrapRef.current = scrap;
  }, [scrap]);

  useEffect(() => {
    if (forgeCores > prevCoresRef.current) {
      setCoresPopKey((k) => k + 1);
    }
    prevCoresRef.current = forgeCores;
  }, [forgeCores]);

  return (
    <header className="shrink-0 bg-[#12151b] border-b border-zinc-800 px-2 sm:px-4 h-11 sm:h-12 flex items-center justify-between gap-2">
      {/* Brand Title + Tank Level */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-display text-xs sm:text-base font-bold tracking-wide text-zinc-100 whitespace-nowrap truncate">
          Ironclad Vanguard
        </span>
        <div
          className="hidden sm:flex flex-col justify-center bg-[#191d25] border border-zinc-700/80 rounded-md px-2 py-0.5 min-w-[78px]"
          title={`Tank Level ${tankLevel} · XP ${tankXp}/${xpNeeded}`}
        >
          <div className="flex items-center justify-between gap-1.5 text-[10px] leading-none">
            <span className="text-zinc-400 font-medium">Tank</span>
            <span className="font-mono-num font-bold text-amber-400">Lv.{tankLevel}</span>
          </div>
          <div className="h-1 w-full bg-zinc-950 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-amber-500 transition-[width] duration-200"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Currencies & Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Scrap Balance */}
        <div
          key={`scrap-${scrapPopKey}`}
          className={`flex items-center gap-1 bg-[#181c24] border border-amber-700/50 rounded-lg px-1.5 sm:px-2 h-8 sm:h-9 ${
            scrapPopKey > 0 ? 'animate-currency-pop' : ''
          }`}
          aria-label={`Scrap balance: ${scrap}`}
        >
          <Cog className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-mono-num text-xs font-bold text-amber-300 whitespace-nowrap">
            {formatCompactNumber(scrap)}
          </span>
        </div>

        {/* Forge Cores Balance */}
        <div
          key={`cores-${coresPopKey}`}
          className={`flex items-center gap-1 bg-[#181c24] border border-zinc-700 rounded-lg px-1.5 sm:px-2 h-8 sm:h-9 ${
            coresPopKey > 0 ? 'animate-currency-pop' : ''
          }`}
          aria-label={`Forge Cores: ${forgeCores}`}
          title="Forge Cores"
        >
          <Cpu className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
          <span className="font-mono-num text-xs font-bold text-zinc-200 whitespace-nowrap">
            {formatCompactNumber(forgeCores)}
          </span>
        </div>

        {/* Sound Mute / Unmute */}
        <button
          type="button"
          onClick={onToggleMute}
          className={`h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg border active:scale-[0.95] transition-all ${
            isMuted
              ? 'bg-[#1a1d24] border-red-800/60 text-red-400 hover:text-red-300'
              : 'bg-[#181c24] border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500'
          }`}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          title={isMuted ? 'Unmute audio' : 'Mute audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Pause / Resume */}
        <button
          type="button"
          onClick={onTogglePause}
          className={`h-8 w-8 sm:h-9 sm:w-auto sm:px-2.5 flex items-center justify-center gap-1.5 rounded-lg font-semibold text-xs whitespace-nowrap shrink-0 active:scale-[0.95] transition-all ${
            isPaused
              ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold border border-emerald-500'
              : 'bg-[#181c24] hover:bg-zinc-800 text-zinc-200 border border-zinc-700'
          }`}
          aria-label={isPaused ? 'Resume combat' : 'Pause combat'}
          title={isPaused ? 'Resume combat' : 'Pause combat'}
        >
          {isPaused ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pause</span>
            </>
          )}
        </button>

        {/* Fullscreen Toggle */}
        {canFullscreen && (
          <button
            type="button"
            data-fullscreen-toggle="true"
            onClick={onToggleFullscreen}
            className={`h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg border active:scale-[0.95] transition-all ${
              isFullscreen
                ? 'bg-amber-600/20 border-amber-500/55 text-amber-300 hover:text-amber-200'
                : 'bg-[#181c24] border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500'
            }`}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Reset Trigger */}
        <button
          type="button"
          onClick={onRequestReset}
          className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg bg-[#181c24] border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-700/60 active:scale-[0.95] transition-all"
          aria-label="Reset progress"
          title="Reset progress"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
