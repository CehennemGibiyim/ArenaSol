"use client";

import type { ReactNode } from "react";

export { Card, CardHeader, Badge } from "@/components/ui";

export function InputRow({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "password";
  placeholder?: string;
  options?: string[];
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {options ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className="input">
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="input"
        />
      )}
      {hint ? <p className="mt-1 text-[9.5px] text-white/25">{hint}</p> : null}
    </div>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <p className="eyebrow mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
