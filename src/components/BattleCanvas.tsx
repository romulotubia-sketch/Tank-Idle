import React, { useEffect, useRef } from 'react';
import { Pause } from 'lucide-react';
import { soundFx } from '../game/audio';
import { BattleEngine } from '../game/engine';

interface BattleCanvasProps {
  engine: BattleEngine;
  isPaused: boolean;
  compactOnMobile?: boolean;
}

export const BattleCanvas: React.FC<BattleCanvasProps> = ({
  engine,
  isPaused,
  compactOnMobile = false,
}) => {
  const containerRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 640, height: 480 });

  useEffect(() => {
    const container = wrapperRef.current;
    const canvas = containerRef.current;
    if (!container || !canvas) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(240, Math.floor(rect.width));
      const height = Math.max(140, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sizeRef.current = { width, height };
    };

    updateCanvasSize();
    const observer = new ResizeObserver(() => updateCanvasSize());
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      engine.step(dt);

      const canvas = containerRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const { width, height } = sizeRef.current;
          ctx.save();
          ctx.scale(dpr, dpr);
          engine.render(ctx, width, height);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [engine]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    soundFx.unlock();
    const canvas = containerRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    engine.handlePointerTap(x, y, rect.width, rect.height);
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden bg-[#101318] border border-zinc-800 rounded-xl select-none shadow-md ${
        compactOnMobile
          ? 'h-44 sm:h-52 lg:h-full lg:min-h-[360px]'
          : 'h-full min-h-[220px] sm:min-h-[280px]'
      }`}
    >
      <canvas
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="block w-full h-full touch-none cursor-crosshair"
        aria-label="Tank Battlefield Arena"
      />

      {/* Icon-only pause dim (no hovering letters on the battle screen) */}
      {isPaused && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black/45 flex items-center justify-center"
        >
          <div className="w-14 h-14 rounded-xl bg-zinc-900/90 border border-amber-500/50 flex items-center justify-center text-amber-400">
            <Pause className="w-7 h-7" />
          </div>
        </div>
      )}
    </div>
  );
};
