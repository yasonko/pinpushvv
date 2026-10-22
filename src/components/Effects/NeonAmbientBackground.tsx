import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Zap, Eye, EyeOff, Sliders, Flame, Palette } from 'lucide-react';

export type NeonThemeMode = 'ruby' | 'cyberpunk' | 'aurora' | 'matrix' | 'minimal';

interface NeonAmbientBackgroundProps {
  isDarkMode?: boolean;
}

export const NeonAmbientBackground: React.FC<NeonAmbientBackgroundProps> = ({
  isDarkMode = true,
}) => {
  const [themeMode, setThemeMode] = useState<NeonThemeMode>('ruby');
  const [isEnabled, setIsEnabled] = useState(true);
  const [intensity, setIntensity] = useState<'high' | 'medium' | 'subtle'>('medium');
  const [showControls, setShowControls] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePosRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  // Floating particles canvas animation
  useEffect(() => {
    if (!isEnabled || !isDarkMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle colors based on theme
    const getColorPalette = (mode: NeonThemeMode) => {
      switch (mode) {
        case 'ruby':
          return ['#E60023', '#FF2A55', '#FF5E7E', '#8B5CF6', '#F43F5E'];
        case 'cyberpunk':
          return ['#E60023', '#06B6D4', '#8B5CF6', '#EC4899', '#3B82F6'];
        case 'aurora':
          return ['#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#A855F7'];
        case 'matrix':
          return ['#10B981', '#059669', '#34D399', '#064E3B', '#6EE7B7'];
        case 'minimal':
        default:
          return ['#E60023', '#3B82F6', '#8B5CF6'];
      }
    };

    const particleCount = intensity === 'high' ? 42 : intensity === 'medium' ? 24 : 14;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      baseAlpha: number;
      pulseSpeed: number;
      pulseAngle: number;
      glowRadius: number;
    }

    const colors = getColorPalette(themeMode);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const baseAlpha = Math.random() * 0.45 + 0.2;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -Math.random() * 0.6 - 0.2, // Drift upward
        size: Math.random() * 2.5 + 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: baseAlpha,
        baseAlpha,
        pulseSpeed: Math.random() * 0.03 + 0.01,
        pulseAngle: Math.random() * Math.PI * 2,
        glowRadius: Math.random() * 8 + 4,
      });
    }

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Gentle sinusoidal sway
        p.x += Math.sin(p.pulseAngle) * 0.25;
        p.pulseAngle += p.pulseSpeed;

        // Alpha pulsing
        p.alpha = p.baseAlpha + Math.sin(p.pulseAngle) * 0.15;

        // Wrap around
        if (p.y < -20) {
          p.y = height + 20;
          p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;

        // Draw particle neon glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        // Core
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.1, Math.min(1, p.alpha));
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glowRadius * (intensity === 'high' ? 1.5 : 1);
        ctx.fill();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isEnabled, isDarkMode, themeMode, intensity]);

  // Track mouse for interactive neon spotlight
  const handleMouseMove = (e: React.MouseEvent) => {
    mousePosRef.current = {
      x: e.clientX,
      y: e.clientY,
      active: true,
    };
  };

  if (!isEnabled) return null;

  // Theme-specific glow gradients for floating orbs
  const getOrbGlows = () => {
    switch (themeMode) {
      case 'ruby':
        return {
          orb1: 'from-[#E60023]/25 to-rose-600/10',
          orb2: 'from-purple-600/20 to-pink-500/10',
          orb3: 'from-[#E60023]/15 to-amber-500/10',
          glowBorder: 'border-red-500/20',
        };
      case 'cyberpunk':
        return {
          orb1: 'from-[#E60023]/25 to-pink-600/15',
          orb2: 'from-cyan-500/25 to-blue-600/15',
          orb3: 'from-purple-600/20 to-indigo-500/10',
          glowBorder: 'border-cyan-500/20',
        };
      case 'aurora':
        return {
          orb1: 'from-emerald-500/20 to-teal-500/15',
          orb2: 'from-cyan-500/25 to-blue-600/15',
          orb3: 'from-indigo-500/20 to-purple-500/15',
          glowBorder: 'border-emerald-500/20',
        };
      case 'matrix':
        return {
          orb1: 'from-emerald-500/30 to-green-600/15',
          orb2: 'from-teal-500/20 to-emerald-700/15',
          orb3: 'from-green-600/20 to-emerald-950/20',
          glowBorder: 'border-emerald-500/30',
        };
      case 'minimal':
      default:
        return {
          orb1: 'from-[#E60023]/15 to-transparent',
          orb2: 'from-blue-600/10 to-transparent',
          orb3: 'from-purple-600/10 to-transparent',
          glowBorder: 'border-white/[0.05]',
        };
    }
  };

  const orbs = getOrbGlows();
  const intensityOpacity = intensity === 'high' ? 'opacity-90' : intensity === 'medium' ? 'opacity-65' : 'opacity-40';

  return (
    <>
      {/* 1. Large Ambient Floating Neon Orbs */}
      <div 
        className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
        aria-hidden="true"
      >
        {/* Floating Neon Orb 1 (Top Right Drift) */}
        <div
          className={`absolute -top-20 -right-20 w-[480px] h-[480px] rounded-full bg-gradient-to-br ${orbs.orb1} blur-[90px] animate-neon-float-1 ${intensityOpacity} transition-all duration-700`}
        />

        {/* Floating Neon Orb 2 (Bottom Left Drift) */}
        <div
          className={`absolute -bottom-32 -left-32 w-[520px] h-[520px] rounded-full bg-gradient-to-tr ${orbs.orb2} blur-[100px] animate-neon-float-2 ${intensityOpacity} transition-all duration-700`}
        />

        {/* Floating Neon Orb 3 (Center Deep Pulse) */}
        <div
          className={`absolute top-1/3 right-1/4 w-[380px] h-[380px] rounded-full bg-gradient-to-bl ${orbs.orb3} blur-[110px] animate-neon-float-3 ${intensityOpacity} transition-all duration-700`}
        />

        {/* Floating Canvas Sparks */}
        {isDarkMode && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}
      </div>

      {/* 2. Interactive Floating Neon Control Mini-Badge */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className="relative">
          {/* Main Floating Neon Action Trigger */}
          <motion.button
            whileHover={{ scale: 1.06, y: -2 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setShowControls(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xl backdrop-blur-xl cursor-pointer ${
              isDarkMode
                ? 'bg-black/80 text-white border border-white/[0.12] hover:border-red-500/50 shadow-red-950/30'
                : 'bg-white/90 text-slate-800 border border-slate-200 shadow-slate-300/40'
            }`}
            title="Neon Ambient & Movement Effects"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E60023] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E60023]"></span>
            </span>
            <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
            <span className="text-[11px] font-mono tracking-tight hidden sm:inline">NEON FX</span>
          </motion.button>

          {/* Floating Neon Controls Menu Popover */}
          <AnimatePresence>
            {showControls && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowControls(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute right-0 bottom-full mb-2 w-64 p-3.5 rounded-2xl bg-black/90 backdrop-blur-2xl border border-white/[0.14] text-white shadow-2xl z-40 space-y-3 font-sans"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Flame className="w-3.5 h-3.5 text-[#E60023]" />
                      <span>Neon Floating Ambiance</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEnabled(prev => !prev)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
                      title={isEnabled ? 'Disable Neon FX' : 'Enable Neon FX'}
                    >
                      {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                    </button>
                  </div>

                  {/* Theme Presets */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Neon Theme Mood
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                      {[
                        { id: 'ruby', label: 'Ruby Cyber', color: '#E60023' },
                        { id: 'cyberpunk', label: 'Cyberpunk', color: '#06B6D4' },
                        { id: 'aurora', label: 'Aurora Flow', color: '#10B981' },
                        { id: 'matrix', label: 'Matrix Neo', color: '#059669' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setThemeMode(preset.id as NeonThemeMode)}
                          className={`flex items-center gap-2 p-1.5 rounded-xl border text-[11px] transition-all cursor-pointer ${
                            themeMode === preset.id
                              ? 'bg-white/[0.12] border-white/40 text-white font-bold shadow-xs'
                              : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Intensity Switcher */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Movement Intensity
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-white/[0.04] p-1 rounded-xl text-[10px] font-bold">
                      {(['subtle', 'medium', 'high'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setIntensity(lvl)}
                          className={`py-1 rounded-lg capitalize cursor-pointer transition-all ${
                            intensity === lvl
                              ? 'bg-[#E60023] text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};
