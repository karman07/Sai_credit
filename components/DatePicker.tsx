"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * A drop-in replacement for <input type="date"> / <input type="month">: same props (value as "YYYY-MM-DD" or
 * "YYYY-MM", min, max, disabled, className, onChange(e) reading e.target.value) but with a proper calendar popover —
 * month/year jump, Today / Clear shortcuts, keyboard friendly — rendered in a portal so dialogs and scroll areas never clip it.
 */
type Props = {
  value?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  type?: "date" | "month";
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  title?: string;
  "aria-label"?: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayStr = () => { const t = new Date(); return ymd(t.getFullYear(), t.getMonth(), t.getDate()); };

function parse(v?: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(v ?? "");
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = m[3] ? +m[3] : 1;
  return mo >= 0 && mo < 12 ? { y, m: mo, d } : null;
}

function format(v: string | undefined, type: "date" | "month") {
  const p = parse(v);
  if (!p) return "";
  return type === "month" ? `${MONTHS[p.m].slice(0, 3)} ${p.y}` : `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
}

export function DatePicker({ value = "", onChange, type = "date", min, max, disabled, required, placeholder, className, id, name, title, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const sel = parse(value);
  const today = new Date();
  const [view, setView] = useState({ y: sel?.y ?? today.getFullYear(), m: sel?.m ?? today.getMonth() });
  const [mode, setMode] = useState<"days" | "months" | "years">(type === "month" ? "months" : "days");
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);

  const emit = useCallback((v: string) => onChange?.({ target: { value: v, name } }), [onChange, name]);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const h = pop.current?.offsetHeight ?? 340, w = pop.current?.offsetWidth ?? 288;
    const up = r.bottom + h + 8 > window.innerHeight && r.top > h + 8;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    setPos({ top: up ? r.top - h - 6 : r.bottom + 6, left, up });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, mode, view, place]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    const onMove = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  const openIt = () => {
    if (disabled) return;
    const p = parse(value);
    const t = new Date();
    setView({ y: p?.y ?? t.getFullYear(), m: p?.m ?? t.getMonth() });
    setMode(type === "month" ? "months" : "days");
    setOpen(true);
  };

  const outOfRange = (s: string) => (!!min && s < min.slice(0, s.length)) || (!!max && s > max.slice(0, s.length));

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: { d: number; cur: boolean; y: number; m: number }[] = [];
    const prevDays = new Date(view.y, view.m, 0).getDate();
    for (let i = lead - 1; i >= 0; i--) out.push({ d: prevDays - i, cur: false, y: view.m === 0 ? view.y - 1 : view.y, m: (view.m + 11) % 12 });
    for (let d = 1; d <= days; d++) out.push({ d, cur: true, y: view.y, m: view.m });
    while (out.length % 7 !== 0 || out.length < 42) {
      const d = out.length - lead - days + 1;
      out.push({ d, cur: false, y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 });
    }
    return out;
  }, [view]);

  const shiftMonth = (n: number) => setView((v) => { const t = new Date(v.y, v.m + n, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const yearStart = Math.floor(view.y / 12) * 12;
  const nav = "size-7 grid place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors";

  const display = format(value, type);
  const base = className ?? "input-base";

  return (
    <>
      <button
        ref={btn} type="button" id={id} title={title} disabled={disabled} onClick={() => (open ? setOpen(false) : openIt())}
        aria-haspopup="dialog" aria-expanded={open} aria-label={rest["aria-label"]}
        className={`${base} inline-flex items-center justify-between gap-2 text-left ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`truncate ${display ? "" : "text-muted"}`}>{display || placeholder || (type === "month" ? "Select month" : "Select date")}</span>
        <CalendarDays className="size-3.5 text-muted shrink-0" />
      </button>
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => {}} className="sr-only" style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }} />}

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={pop} role="dialog" aria-label="Choose date"
          style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: 100000 }}
          className="w-72 rounded-xl border border-border bg-surface shadow-2xl p-3 animate-fadeIn select-none"
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <button type="button" className={nav} onClick={() => (mode === "days" ? shiftMonth(-1) : mode === "months" ? setView((v) => ({ ...v, y: v.y - 1 })) : setView((v) => ({ ...v, y: v.y - 12 })))} aria-label="Previous"><ChevronLeft className="size-4" /></button>
            <div className="flex items-center gap-1 text-sm font-semibold">
              {mode === "days" && <button type="button" onClick={() => setMode("months")} className="px-2 py-1 rounded-md hover:bg-surface-2">{MONTHS[view.m]}</button>}
              <button type="button" onClick={() => setMode(mode === "years" ? (type === "month" ? "months" : "days") : "years")} className="px-2 py-1 rounded-md hover:bg-surface-2">
                {mode === "years" ? `${yearStart} – ${yearStart + 11}` : view.y}
              </button>
            </div>
            <button type="button" className={nav} onClick={() => (mode === "days" ? shiftMonth(1) : mode === "months" ? setView((v) => ({ ...v, y: v.y + 1 })) : setView((v) => ({ ...v, y: v.y + 12 })))} aria-label="Next"><ChevronRight className="size-4" /></button>
          </div>

          {mode === "days" && (
            <>
              <div className="grid grid-cols-7 mb-1">
                {WEEK.map((w) => <span key={w} className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center py-1">{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((c, i) => {
                  const s = ymd(c.y, c.m, c.d);
                  const isSel = s === value.slice(0, 10), isToday = s === todayStr(), off = outOfRange(s);
                  return (
                    <button
                      key={i} type="button" disabled={off}
                      onClick={() => { emit(s); setOpen(false); btn.current?.focus(); }}
                      className={[
                        "h-8 text-xs rounded-md grid place-items-center transition-colors",
                        isSel ? "bg-primary text-primary-foreground font-semibold" : c.cur ? "text-foreground hover:bg-surface-2" : "text-muted/60 hover:bg-surface-2",
                        isToday && !isSel ? "ring-1 ring-primary/60 font-semibold" : "",
                        off ? "opacity-30 cursor-not-allowed hover:bg-transparent" : "",
                      ].join(" ")}
                    >{c.d}</button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "months" && (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((n, i) => {
                const s = type === "month" ? `${view.y}-${pad(i + 1)}` : ymd(view.y, i, 1).slice(0, 7);
                const isSel = value.slice(0, 7) === s, off = type === "month" ? outOfRange(s) : false;
                return (
                  <button
                    key={n} type="button" disabled={off}
                    onClick={() => { if (type === "month") { emit(s); setOpen(false); btn.current?.focus(); } else { setView((v) => ({ ...v, m: i })); setMode("days"); } }}
                    className={`h-9 rounded-md text-xs ${isSel ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-surface-2"} ${off ? "opacity-30 cursor-not-allowed" : ""}`}
                  >{n.slice(0, 3)}</button>
                );
              })}
            </div>
          )}

          {mode === "years" && (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
                <button
                  key={y} type="button"
                  onClick={() => { setView((v) => ({ ...v, y })); setMode(type === "month" ? "months" : "days"); }}
                  className={`h-9 rounded-md text-xs ${y === view.y ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-surface-2"}`}
                >{y}</button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
            <button
              type="button" className="text-xs font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline"
              disabled={outOfRange(type === "month" ? todayStr().slice(0, 7) : todayStr())}
              onClick={() => { emit(type === "month" ? todayStr().slice(0, 7) : todayStr()); setOpen(false); btn.current?.focus(); }}
            >{type === "month" ? "This month" : "Today"}</button>
            {!required && value && (
              <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground" onClick={() => { emit(""); setOpen(false); btn.current?.focus(); }}>
                <X className="size-3" /> Clear
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
