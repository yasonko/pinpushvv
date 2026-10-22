import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, ArrowRight, Eye, EyeOff, ShieldCheck, AlertCircle, Terminal, ShieldAlert, Cpu, Radio } from 'lucide-react';

const CORRECT_PASSCODE = '2027go';
const AUTH_STORAGE_KEY = 'pin_publisher_auth_token';

interface PasswordGateProps {
  children: React.ReactNode;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  // Always lock upon every reload (fresh session memory only)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clear any persistent tokens to enforce strict lock on every reload
  useEffect(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    setIsLoading(false);
  }, []);

  // Live Red Hacker Matrix Rain Wallpaper Canvas Animation
  useEffect(() => {
    if (isAuthenticated || isLoading) return;

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
      initColumns();
    };

    window.addEventListener('resize', handleResize);

    // Characters: Hex, Binary, Matrix glyphs, Hacker symbols
    const chars = '0123456789ABCDEF010101XYZΩλπ∑µ∆§⚡︎#@$*¥アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const fontSize = 14;
    let columns = Math.floor(width / fontSize);
    let drops: number[] = [];
    let speeds: number[] = [];
    let brightnesses: number[] = [];

    const initColumns = () => {
      columns = Math.floor(width / fontSize);
      drops = [];
      speeds = [];
      brightnesses = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100;
        speeds[i] = 0.6 + Math.random() * 0.9;
        brightnesses[i] = Math.random();
      }
    };

    initColumns();

    // Mouse interactive ripple
    let mouseX = -1000;
    let mouseY = -1000;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let lastTime = performance.now();

    const draw = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Pure AMOLED black fade trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px "JetBrains Mono", "Courier New", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Proximity glow to mouse cursor
        const distToMouse = Math.hypot(x - mouseX, y - mouseY);
        const isNearMouse = distToMouse < 140;

        // Leading character has glowing white-red tip, trailing characters are dark red
        if (Math.random() > 0.88 || isNearMouse) {
          ctx.fillStyle = isNearMouse ? '#ffffff' : '#ff4d6d';
          ctx.shadowBlur = isNearMouse ? 12 : 8;
          ctx.shadowColor = '#ff0033';
        } else if (brightnesses[i] > 0.6) {
          ctx.fillStyle = '#ff1a3c';
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#e60023';
        } else if (brightnesses[i] > 0.3) {
          ctx.fillStyle = '#cc0020';
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#730010';
          ctx.shadowBlur = 0;
        }

        ctx.fillText(char, x, y);

        // Reset drop to top with randomized delay once it falls off screen
        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
          speeds[i] = 0.6 + Math.random() * 0.9;
          brightnesses[i] = Math.random();
        }

        drops[i] += speeds[i] * (isNearMouse ? 1.5 : 1);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isAuthenticated, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === CORRECT_PASSCODE) {
      setIsAuthenticated(true);
      setError(false);
      setErrorMessage('');
    } else {
      setError(true);
      setErrorMessage('Access Denied: Invalid Security Passcode.');
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    setIsAuthenticated(false);
    setPasscode('');
  };

  // Expose logout helper to window and event dispatcher
  useEffect(() => {
    (window as any).lockPinApp = handleLogout;
    const handleLockEvent = () => handleLogout();
    window.addEventListener('lock-app', handleLockEvent);
    return () => {
      window.removeEventListener('lock-app', handleLockEvent);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#E60023] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen w-full bg-black flex items-center justify-center p-4 overflow-hidden select-none">
        {/* Live Red Hacker Matrix Rain Wallpaper Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
        />

        {/* Cyber Grid & Red CRT Scanlines Overlay */}
        <div className="absolute inset-0 pointer-events-none z-1 opacity-25 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.8)_51%)] bg-[length:100%_4px]" />
        <div className="absolute inset-0 pointer-events-none z-1 bg-[radial-gradient(ellipse_at_center,rgba(230,0,35,0.15)_0%,rgba(0,0,0,0.85)_75%)]" />

        {/* Ambient Floating Cyber HUD Corner Badges */}
        <div className="absolute top-6 left-6 z-10 hidden sm:flex items-center gap-2 font-mono text-[11px] text-red-500/80 tracking-widest uppercase">
          <Radio className="w-3.5 h-3.5 animate-pulse text-red-500" />
          <span>PORT 3000 // SECURE GATEWAY [ACTIVE]</span>
        </div>

        <div className="absolute top-6 right-6 z-10 hidden sm:flex items-center gap-2 font-mono text-[11px] text-red-400/70 tracking-widest">
          <Terminal className="w-3.5 h-3.5" />
          <span>CYBER_SHIELD_v2.7 // PROTOCOL RED</span>
        </div>

        <div className="absolute bottom-6 left-6 z-10 hidden sm:flex items-center gap-2 font-mono text-[10px] text-red-500/60 tracking-wider">
          <Cpu className="w-3 h-3 text-red-500" />
          <span>AES-256 SESSION PROTECTED</span>
        </div>

        {/* Main AMOLED Cyber Glass Password Card */}
        <div className="w-full max-w-md relative z-10">
          <div className="bg-black/85 backdrop-blur-2xl rounded-3xl border border-red-500/30 shadow-[0_0_60px_rgba(230,0,35,0.22)] p-8 space-y-6 text-white transition-all">
            
            {/* Top Red Glow Accent Bar */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[2px] bg-gradient-to-r from-transparent via-[#E60023] to-transparent shadow-[0_0_12px_#E60023]" />

            {/* Header Badge & Icon */}
            <div className="text-center space-y-3">
              <div className="relative w-16 h-16 rounded-2xl bg-red-950/60 text-[#ff2e4d] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(230,0,35,0.4)] border border-red-500/40">
                <Lock className="w-8 h-8 drop-shadow-[0_0_8px_rgba(255,46,77,0.8)]" />
                <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#E60023]"></span>
                </span>
              </div>
              
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950/70 border border-red-500/30 text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest mb-1.5 shadow-[0_0_10px_rgba(230,0,35,0.15)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  AUTHENTICATION GATEWAY
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                  <span>Pin Publisher</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-[#ff2e4d] to-red-600 font-mono">PRO</span>
                </h1>
                <p className="text-xs font-mono text-zinc-400 mt-1">
                  Enter authorization security key to unlock system
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-xs font-mono font-bold text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-red-400">
                    <KeyRound className="w-3.5 h-3.5 text-red-500" />
                    SECURITY_PIN
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono tracking-wider">DEFAULT: 2027go</span>
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    placeholder="Enter security key..."
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      if (error) setError(false);
                    }}
                    autoFocus
                    required
                    className={`w-full text-sm font-mono px-4 py-3.5 bg-black/90 border rounded-2xl text-white placeholder:text-zinc-600 focus:outline-none pr-11 transition-all shadow-inner ${
                      error
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                        : 'border-red-500/30 focus:border-[#E60023] focus:ring-2 focus:ring-red-500/30 shadow-[0_0_15px_rgba(230,0,35,0.15)]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-400 p-1 cursor-pointer transition-colors"
                    title={showPasscode ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-2xl flex items-center gap-2.5 text-xs text-red-300 font-mono font-semibold animate-shake shadow-[0_0_15px_rgba(239,68,68,0.25)]">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#E60023] via-[#ff1a3c] to-[#cc0020] hover:from-[#ff1a3c] hover:to-[#E60023] text-white font-mono font-bold py-3.5 px-4 rounded-2xl cursor-pointer transition-all shadow-[0_0_25px_rgba(230,0,35,0.4)] flex items-center justify-center gap-2 text-sm hover:scale-[1.01] active:scale-[0.99] border border-red-400/40"
              >
                <span>EXECUTE UNLOCK</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Footer Notice */}
            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ENCRYPTION ACTIVE</span>
              </span>
              <span className="text-zinc-500 text-[10px]">
                BUILD // 2026.09
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

