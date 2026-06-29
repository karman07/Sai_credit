"use client";

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const CUR_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CUR_YEAR - 2 + i);

interface Props {
  value: string;          // "YYYY-MM"
  onChange: (v: string) => void;
  className?: string;
}

export function MonthPicker({ value, onChange, className = "" }: Props) {
  const [y, m] = value ? value.split("-") : [String(CUR_YEAR), String(new Date().getMonth() + 1).padStart(2, "0")];

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <select
        value={m}
        onChange={(e) => onChange(`${y}-${e.target.value}`)}
        className="input text-sm"
      >
        {MONTHS.map((label, i) => {
          const val = String(i + 1).padStart(2, "0");
          return <option key={val} value={val}>{label}</option>;
        })}
      </select>
      <select
        value={y}
        onChange={(e) => onChange(`${e.target.value}-${m}`)}
        className="input text-sm"
      >
        {YEARS.map((yr) => <option key={yr} value={String(yr)}>{yr}</option>)}
      </select>
    </div>
  );
}
