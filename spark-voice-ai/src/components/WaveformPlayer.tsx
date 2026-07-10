import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

// Player de forma de onda. Com `src` (MP3 real) toca o áudio e anima o playhead;
// sem `src` sintetiza uma prévia de voz (Web Audio) com barras reativas.
const BAR_COUNT = 46;

function barHeights(): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => Math.sin(i * 0.7) * 0.4 + Math.sin(i * 0.27) * 0.3 + 0.5);
}

export function WaveformPlayer({ src, duration = '0:04' }: { src?: string; duration?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>();
  const acRef = useRef<AudioContext>();
  const [playing, setPlaying] = useState(false);
  const bars = useRef<number[]>(barHeights());

  const BRAND = '#2563EB';
  const BRAND2 = '#1D4ED8';

  function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.fill();
  }

  function draw(progress = 0, live?: Uint8Array) {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const w = (cv.width = cv.clientWidth * 2);
    const h = (cv.height = cv.clientHeight * 2);
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, BRAND);
    g.addColorStop(1, BRAND2);
    ctx.fillStyle = g;
    const n = live ? live.length : bars.current.length;
    for (let i = 0; i < n; i++) {
      const v = live ? live[i] / 255 : bars.current[i];
      const bh = Math.max(h * 0.06, v * h * (live ? 0.92 : 0.7) + (live ? 0 : h * 0.06));
      const x = i * (w / n);
      ctx.globalAlpha = live ? 1 : 0.34;
      rr(ctx, x + 2, (h - bh) / 2, w / n - 4, bh, 3);
    }
    ctx.globalAlpha = 1;
    if (progress > 0) {
      ctx.fillStyle = BRAND2;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(progress * w, 0, 2, h);
      ctx.globalAlpha = 1;
    }
  }

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    draw();
  }

  function playReal() {
    const audio = audioRef.current ?? new Audio(src);
    audioRef.current = audio;
    audio.play();
    setPlaying(true);
    const loop = () => {
      const p = audio.duration ? audio.currentTime / audio.duration : 0;
      draw(p);
      if (!audio.paused && !audio.ended) rafRef.current = requestAnimationFrame(loop);
      else stop();
    };
    audio.onended = stop;
    rafRef.current = requestAnimationFrame(loop);
  }

  function playSynth() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = acRef.current ?? new AC();
    acRef.current = ac;
    if (ac.state === 'suspended') ac.resume();
    const dur = 3;
    const t0 = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 128;
    master.connect(analyser);
    [196, 220, 247, 262, 220, 196].forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = 'sine';
      const g = ac.createGain();
      o.frequency.setValueAtTime(f, t0 + i * 0.5);
      o.frequency.linearRampToValueAtTime(f * 1.05, t0 + i * 0.5 + 0.25);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.5);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + i * 0.5 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.45);
      o.connect(g);
      g.connect(master);
      o.start(t0 + i * 0.5);
      o.stop(t0 + i * 0.5 + 0.5);
    });
    setPlaying(true);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const start = performance.now();
    const loop = () => {
      const el = (performance.now() - start) / 1000;
      if (el > dur) return stop();
      analyser.getByteFrequencyData(data);
      draw(el / dur, data);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function toggle() {
    if (playing) {
      audioRef.current?.pause();
      stop();
      return;
    }
    if (src) playReal();
    else playSynth();
  }

  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-ink-200 bg-gradient-to-b from-ink-50 to-white p-3">
      <button
        onClick={toggle}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition hover:scale-105"
        style={{
          background: 'linear-gradient(180deg,#3B82F6,#2563EB)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / .4), 0 8px 18px -8px rgb(37 99 235 / .7)',
        }}
        aria-label={playing ? 'Pausar' : 'Ouvir'}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="h-11 flex-1">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      <span className="min-w-[64px] text-right text-xs tabular-nums text-ink-500">0:00 / {duration}</span>
    </div>
  );
}
