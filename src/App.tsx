import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * FreeType WPM — with Light/Dark toggle and optional typing timer
 * - Big colourful UI, large typing area
 * - Pause/Resume, Reset, CSV export
 * - Optional countdown timer (auto-stops when time is up)
 */

export default function TypingSpeedApp() {
  useInjectStyles();

  // THEME
  const [theme, setTheme] = useState<'dark' | 'light'>(() => 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // typing state
  const [text, setText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastStart, setLastStart] = useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [now, setNow] = useState<number>(Date.now());

  // accuracy via keystrokes
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [backspaces, setBackspaces] = useState(0);

  // TIMER
  const [timerMinutes, setTimerMinutes] = useState<number>(0); // 0 = off
  const timerEnabled = timerMinutes > 0;
  const timerMs = timerMinutes * 60000;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ticker for time
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [isRunning]);

  const activeElapsedMs = useMemo(() => {
    const runningMs = isRunning && lastStart ? now - lastStart : 0;
    return accumulatedMs + runningMs;
  }, [accumulatedMs, isRunning, lastStart, now]);

  // Stop automatically when timer elapses
  useEffect(() => {
    if (!timerEnabled) return;
    if (!isRunning) return;
    if (activeElapsedMs >= timerMs && timerMs > 0) {
      // time up → pause
      setIsRunning(false);
      setLastStart(null);
    }
  }, [activeElapsedMs, timerEnabled, timerMs, isRunning]);

  const elapsedMinutes = activeElapsedMs / 60000;

  const stats = useMemo(() => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const wpmGross = elapsedMinutes > 0 ? (chars / 5) / elapsedMinutes : 0;
    const accuracy = totalKeystrokes > 0 ? (chars / totalKeystrokes) * 100 : 100;
    const netWpm = wpmGross * (accuracy / 100);
    return {
      chars,
      words,
      wpmGross: Number.isFinite(wpmGross) ? wpmGross : 0,
      netWpm: Number.isFinite(netWpm) ? netWpm : 0,
      accuracy: Math.max(0, Math.min(100, accuracy)),
    };
  }, [text, elapsedMinutes, totalKeystrokes]);

  function startIfNeeded() {
    const ts = Date.now();
    if (startedAt == null) setStartedAt(ts);
    if (!isRunning) {
      setIsRunning(true);
      setLastStart(ts);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (e.target.value.length > 0) startIfNeeded();
    setText(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const key = e.key;
    const isPrintable = key.length === 1 || key === "Enter" || key === "Tab" || key === " " || key === "Spacebar";
    if (isPrintable) setTotalKeystrokes((k) => k + 1);
    if (key === "Backspace") {
      setBackspaces((b) => b + 1);
      setTotalKeystrokes((k) => k + 1);
    }
  }

  function pauseResume() {
    const ts = Date.now();
    if (isRunning) {
      if (lastStart) setAccumulatedMs((ms) => ms + (ts - lastStart));
      setIsRunning(false);
      setLastStart(null);
    } else {
      setIsRunning(true);
      setLastStart(ts);
      if (startedAt == null) setStartedAt(ts);
    }
  }

  function resetAll() {
    setText("");
    setIsRunning(false);
    setStartedAt(null);
    setLastStart(null);
    setAccumulatedMs(0);
    setNow(Date.now());
    setTotalKeystrokes(0);
    setBackspaces(0);
    textareaRef.current?.focus();
  }

  const formattedElapsed = useMemo(() => formatTime(activeElapsedMs), [activeElapsedMs]);
  const remainingMs = timerEnabled ? Math.max(0, timerMs - activeElapsedMs) : 0;
  const formattedRemaining = timerEnabled ? formatTime(remainingMs) : '—';
  const progress = timerEnabled && timerMs > 0 ? Math.min(100, (activeElapsedMs / timerMs) * 100) : 0;

  function downloadReport() {
    const date = new Date().toISOString();
    const row = {
      date,
      duration_seconds: Math.round(activeElapsedMs / 1000),
      characters: stats.chars,
      words: stats.words,
      wpm_gross: Number(stats.wpmGross.toFixed(2)),
      wpm_net: Number(stats.netWpm.toFixed(2)),
      accuracy_percent: Number(stats.accuracy.toFixed(2)),
      keystrokes: totalKeystrokes,
      backspaces,
      timer_minutes: timerMinutes,
    };
    const headers = Object.keys(row).join(",");
    const values = Object.values(row).join(",");
    const csv = headers + "\\n" + values + "\\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `typing-report-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__inner">
          <h1>FreeType WPM</h1>
          <p className="tag">Type anything • Track speed • Export results</p>

          <div className="topbar">
            <div className="controls">
              <button className="btn btn-primary" onClick={pauseResume}>{isRunning ? "Pause" : "Resume"}</button>
              <button className="btn btn-ghost" onClick={resetAll}>Reset</button>
              <button className="btn btn-success" onClick={downloadReport}>Download CSV</button>
            </div>
            <div className="toggles">
              <label className="switch">
                <input type="checkbox" checked={theme === 'dark'} onChange={(e)=> setTheme(e.target.checked ? 'dark' : 'light')} />
                <span>Dark Mode</span>
              </label>
              <div className="timer">
                <label>Timer:</label>
                <select value={timerMinutes} onChange={(e)=> setTimerMinutes(Number(e.target.value))}>
                  <option value={0}>Off</option>
                  <option value={1}>1 min</option>
                  <option value={3}>3 min</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                </select>
                {timerEnabled && (
                  <span className="remaining" title="Time remaining">{formattedRemaining}</span>
                )}
              </div>
            </div>
          </div>

          {timerEnabled && (
            <div className="progress">
              <div className="progress__bar" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </header>

      <main className="content">
        <section className="stats">
          <Stat label="WPM (Gross)" value={stats.wpmGross.toFixed(1)} accent="var(--pink)" />
          <Stat label="WPM (Net)" value={stats.netWpm.toFixed(1)} accent="var(--violet)" />
          <Stat label="Accuracy" value={`${stats.accuracy.toFixed(1)}%`} accent="var(--teal)" />
          <Stat label="Elapsed" value={formattedElapsed} accent="var(--orange)" />
          {timerEnabled && <Stat label="Remaining" value={formattedRemaining} accent="var(--primary)" />}
        </section>

        <section className="editor">
          <label htmlFor="freeType" className="editor__label">Your Text</label>
          <textarea
            id="freeType"
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Start typing here… (timer starts on first keystroke)"
            className="editor__area"
          />
        </section>

        <section className="help">
          <p>
            Gross WPM: <code>(characters / 5) ÷ active minutes</code>. Net WPM = Gross × Accuracy. Accuracy is estimated
            from keystrokes while free typing (no source text). Backspaces count as keystrokes. Mobile keyboards may vary.
          </p>
        </section>
      </main>

      <footer className="footer">Made with ❤️ for fast feedback. </footer>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="card" style={{ ['--accent' as any]: accent }}>
      <div className="card__label">{label}</div>
      <div className="card__value">{value}</div>
    </div>
  );
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Inject CSS theme (light + dark) */
function useInjectStyles() {
  useEffect(() => {
    const id = "freetype-wpm-styles-v3";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      :root{ --bg:#0f172a; --bg-soft:#0b1220; --text:#f8fafc; --muted:#cbd5e1; --card:#111a2d; --ring:#1e293b;
              --pink:#f472b6; --violet:#a78bfa; --teal:#34d399; --orange:#fb923c; --primary:#6366f1; --primary-700:#4f46e5; --success:#10b981; --ghost:#e2e8f0; }
      [data-theme='light']{ --bg:#f8fafc; --bg-soft:#ffffff; --text:#0f172a; --muted:#475569; --card:#ffffff; --ring:#dbe4f1; }
      *{box-sizing:border-box}
      html,body,#root{height:100%}
      body{margin:0;background:linear-gradient(180deg,var(--bg) 0%, var(--bg-soft) 100%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif}
      .app{min-height:100%;display:flex;flex-direction:column}

      .hero{background:radial-gradient(1200px 400px at 20% -20%, rgba(99,102,241,.35), rgba(0,0,0,0)),
                         radial-gradient(800px 300px at 90% 0%, rgba(244,114,182,.25), rgba(0,0,0,0));
             border-bottom:1px solid var(--ring)}
      .hero__inner{max-width:1100px;margin:0 auto;padding:24px 20px 14px}
      .hero h1{font-size:clamp(28px, 4vw, 40px);margin:0}
      .tag{color:var(--muted);margin:6px 0 16px}

      .topbar{display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
      .controls{display:flex;gap:12px;flex-wrap:wrap}
      .btn{cursor:pointer;border:none;border-radius:14px;padding:16px 22px;font-weight:700;letter-spacing:.2px;
           transition:transform .08s ease, box-shadow .2s ease; box-shadow:0 6px 16px rgba(0,0,0,.25); font-size:16px}
      .btn:active{transform:translateY(1px)}
      .btn-primary{background:linear-gradient(135deg,var(--primary),var(--primary-700));color:white}
      .btn-success{background:linear-gradient(135deg,#22c55e,var(--success));color:white}
      .btn-ghost{background:var(--ghost);color:#0f172a}

      .toggles{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
      .switch{display:flex;align-items:center;gap:8px;color:var(--text);font-weight:600}
      .switch input{width:42px;height:22px}
      .timer{display:flex;gap:8px;align-items:center}
      .timer label{color:var(--muted)}
      .timer select{padding:10px 12px;border-radius:10px;border:1px solid var(--ring);background:var(--card);color:var(--text)}
      .remaining{font-weight:700}

      .progress{height:10px;background:rgba(148,163,184,.25);border-radius:999px;overflow:hidden;margin-top:10px}
      .progress__bar{height:100%;background:linear-gradient(90deg,var(--primary),#22c55e)}

      .content{max-width:1100px;margin:0 auto;padding:20px;flex:1;width:100%}

      .stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
      @media (max-width:1100px){.stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media (max-width:680px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:460px){.stats{grid-template-columns:1fr}}

      .card{background:linear-gradient(180deg,rgba(17,26,45,.85), rgba(17,26,45,.6));
            border:1px solid var(--ring);border-radius:18px;padding:16px 18px;position:relative;overflow:hidden}
      [data-theme='light'] .card{background:linear-gradient(180deg,rgba(255,255,255,.9), rgba(255,255,255,.7))}
      .card::after{content:\"\";position:absolute;inset:auto -20% -40% -20%;height:90px;background:var(--accent);
                   filter:blur(40px);opacity:.25}
      .card__label{font-size:12px;letter-spacing:.4px;color:var(--muted);text-transform:uppercase}
      .card__value{font-size:32px;font-weight:800;margin-top:6px}

      .editor{margin-top:22px}
      .editor__label{display:block;font-size:14px;color:var(--muted);margin:0 0 10px}
      .editor__area{width:100%;height:55vh;min-height:280px;resize:vertical;border-radius:18px;padding:18px 20px;
                    background:var(--card);color:var(--text);outline:none;border:1px solid var(--ring);
                    box-shadow:inset 0 0 0 1px rgba(148,163,184,.08), 0 10px 30px rgba(0,0,0,.25);
                    font-size:17px;line-height:1.7}
      .editor__area:focus{box-shadow:0 0 0 3px rgba(99,102,241,.35), inset 0 0 0 1px rgba(148,163,184,.08)}

      .help{color:var(--muted);margin-top:14px}
      .help code{background:rgba(148,163,184,.18);padding:2px 6px;border-radius:6px}

      .footer{padding:18px 20px;border-top:1px solid var(--ring);text-align:center;color:var(--muted)}
    `;
    document.head.appendChild(style);
    return () => { try { document.head.removeChild(style); } catch {}
    };
  }, []);
}
