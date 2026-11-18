"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { formatMoney, formatNumber, timeAgo } from "@/lib/format";
import { statusTone } from "@/components/ui";

export type RMField = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "boolean";
  options?: Array<string | { value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string | number | boolean;
  half?: boolean;
};

export type RMColumn = {
  key: string;
  label: string;
  format?: "text" | "number" | "money" | "date" | "badge" | "bool" | "user" | "percent" | "score";
};

type Row = Record<string, unknown>;

export function ResourceManager({
  resource,
  title,
  subtitle,
  fields,
  columns,
  filters,
  createLabel = "Yeni kayıt",
  emptyTitle = "Henüz kayıt yok",
  emptyDescription,
  searchPlaceholder = "Ara...",
}: {
  resource: string;
  title: string;
  subtitle?: string;
  fields: RMField[];
  columns: RMColumn[];
  filters?: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }>;
  createLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  searchPlaceholder?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    for (const [key, value] of Object.entries(activeFilter)) {
      if (value) params.set("filter", value);
    }
    try {
      const response = await fetch(`/api/resources/${resource}?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: Row[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Liste alınamadı");
      setRows(payload.data ?? []);
      setError("");
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [resource, query, activeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 220);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const blank = useMemo(() => {
    const value: Record<string, string | boolean> = {};
    for (const field of fields) {
      if (field.type === "boolean") value[field.key] = Boolean(field.defaultValue ?? false);
      else if (field.type === "select") {
        const option = field.options?.[0];
        value[field.key] = String(typeof option === "string" ? option : option?.value ?? "");
      } else value[field.key] = field.defaultValue !== undefined ? String(field.defaultValue) : "";
    }
    return value;
  }, [fields]);

  const openCreate = () => {
    setForm(blank);
    setEditingId(null);
    setError("");
    setDrawerOpen(true);
  };

  const openEdit = (row: Row) => {
    const value: Record<string, string | boolean> = {};
    for (const field of fields) {
      const raw = row[field.key];
      value[field.key] = field.type === "boolean" ? Boolean(raw) : raw === null || raw === undefined ? "" : String(raw);
    }
    setForm(value);
    setEditingId(Number(row.id));
    setError("");
    setDrawerOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = form[field.key];
        if (field.type === "boolean") payload[field.key] = Boolean(raw);
        else if (field.type === "number") payload[field.key] = raw === "" ? 0 : Number(raw);
        else payload[field.key] = raw;
      }
      const response = await fetch(
        editingId ? `/api/resources/${resource}/${editingId}` : `/api/resources/${resource}`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Kayıt başarısız");
      setDrawerOpen(false);
      setNotice(editingId ? "Kayıt güncellendi" : "Kayıt oluşturuldu");
      await load();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`#${row.id} kaydı silinsin mi? Bu işlem geri alınamaz.`)) return;
    try {
      const response = await fetch(`/api/resources/${resource}/${row.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Silinemedi");
      setNotice("Kayıt silindi");
      await load();
    } catch (deleteError) {
      setError((deleteError as Error).message);
    }
  };

  const exportCsv = () => {
    const header = columns.map((column) => column.label).join(";");
    const body = rows
      .map((row) => columns.map((column) => String(row[column.key] ?? "").replace(/;/g, ",")).join(";"))
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arena-${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderCell = (row: Row, column: RMColumn) => {
    const value = row[column.key];
    if (column.format === "user") {
      const text = String(value ?? "—");
      return (
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-cyan-300/30 to-pink-500/30 text-[9.5px] font-bold uppercase text-white">
            {text.slice(0, 2)}
          </span>
          <span className="font-medium text-white/85">@{text}</span>
        </div>
      );
    }
    if (column.format === "money") return <span className="tabular-nums">{formatMoney(Number(value ?? 0))}</span>;
    if (column.format === "number") return <span className="tabular-nums">{formatNumber(Number(value ?? 0))}</span>;
    if (column.format === "date") return <span className="text-white/50">{timeAgo(value as string)}</span>;
    if (column.format === "bool")
      return value ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
          <Check size={12} /> Evet
        </span>
      ) : (
        <span className="text-[11px] text-white/35">Hayır</span>
      );
    if (column.format === "badge") {
      const text = String(value ?? "—");
      const tone = statusTone(text);
      const map: Record<string, string> = {
        emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
        cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
        pink: "border-pink-400/30 bg-pink-500/10 text-pink-200",
        amber: "border-amber-300/30 bg-amber-400/10 text-amber-200",
        violet: "border-violet-400/30 bg-violet-500/10 text-violet-200",
        slate: "border-white/12 bg-white/5 text-white/55",
      };
      return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${map[tone]}`}>
          {text}
        </span>
      );
    }
    if (column.format === "score") {
      const score = Number(value ?? 0);
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, score)}%`, background: score > 80 ? "#34d399" : score > 60 ? "#f5b642" : "#fe2c55" }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-white/70">{score}</span>
        </div>
      );
    }
    return <span className="text-white/70">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>;
  };

  const activeCount = rows.filter((row) => {
    const status = String(row.status ?? row.liveStatus ?? "");
    return ["active", "live", "open", "signed", "won", "paid"].includes(status);
  }).length;

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold tracking-tight text-white/90">{title}</h3>
            <span className="chip">{rows.length} kayıt</span>
            {activeCount > 0 ? (
              <span className="chip !border-emerald-300/25 !bg-emerald-400/10 !text-emerald-200">{activeCount} aktif</span>
            ) : null}
          </div>
          {subtitle ? <p className="mt-1 text-[11.5px] text-white/40">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/30 px-2.5 py-1.5">
            <Search size={13} className="text-white/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-[140px] bg-transparent text-[12px] text-white placeholder:text-white/25 focus:outline-none sm:w-[180px]"
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label="Temizle" className="text-white/30 hover:text-white/70">
                <X size={12} />
              </button>
            ) : null}
          </div>
          {filters?.map((filter) => (
            <select
              key={filter.key}
              value={activeFilter[filter.key] ?? ""}
              onChange={(event) => setActiveFilter((prev) => ({ ...prev, [filter.key]: event.target.value }))}
              className="input !w-auto !py-1.5 !text-[11.5px]"
            >
              <option value="">{filter.label}: Tümü</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
          <button onClick={() => void load()} className="btn !px-2.5 !py-1.5" aria-label="Yenile">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={exportCsv} className="btn !px-2.5 !py-1.5" aria-label="CSV indir">
            <Download size={13} />
          </button>
          <button onClick={openCreate} className="btn btn-primary !py-1.5 !text-[11.5px]">
            <Plus size={13} /> {createLabel}
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-pink-500/20 bg-pink-500/10 px-5 py-2 text-[11.5px] text-pink-200">{error}</div>
      ) : null}
      {notice ? (
        <div className="flex items-center gap-2 border-b border-emerald-400/20 bg-emerald-400/10 px-5 py-2 text-[11.5px] text-emerald-200">
          <Check size={13} /> {notice}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="!py-14 text-center">
                  <span className="inline-flex items-center gap-2 text-[12px] text-white/40">
                    <Loader2 size={14} className="animate-spin" /> Yükleniyor...
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="!py-14 text-center">
                  <p className="text-[13px] font-semibold text-white/70">{emptyTitle}</p>
                  <p className="mt-1 text-[11.5px] text-white/35">{emptyDescription ?? "Yeni kayıt ekleyerek başlayın."}</p>
                  <button onClick={openCreate} className="btn btn-primary mt-3 !text-[11.5px]">
                    <Plus size={13} /> {createLabel}
                  </button>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row.id)}>
                  {columns.map((column) => (
                    <td key={column.key}>{renderCell(row, column)}</td>
                  ))}
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openEdit(row)}
                        className="grid size-6 place-items-center rounded-md border border-white/10 text-white/50 hover:border-cyan-300/40 hover:text-cyan-200"
                        aria-label="Düzenle"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => void remove(row)}
                        className="grid size-6 place-items-center rounded-md border border-white/10 text-white/40 hover:border-pink-400/40 hover:text-pink-300"
                        aria-label="Sil"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button className="flex-1 bg-black/65 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} aria-label="Kapat" />
          <div className="h-full w-full max-w-[430px] overflow-y-auto border-l border-white/10 bg-[#08080f] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{editingId ? "Düzenle" : "Yeni kayıt"}</p>
                <h3 className="mt-1 text-[18px] font-bold tracking-tight text-white">{title}</h3>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-white/40 hover:text-white" aria-label="Kapat">
                <X size={17} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((field) => (
                <div key={field.key} className={field.half ? "col-span-1" : "col-span-2"}>
                  <label className="label" htmlFor={`field-${field.key}`}>
                    {field.label} {field.required ? <span className="text-pink-400">*</span> : null}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={`field-${field.key}`}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="input"
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={`field-${field.key}`}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      className="input"
                    >
                      {(field.options ?? []).map((option) => {
                        const value = typeof option === "string" ? option : option.value;
                        const label = typeof option === "string" ? option : option.label;
                        return (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  ) : field.type === "boolean" ? (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                      className={`flex h-[38px] w-full items-center justify-between rounded-[10px] border px-3 text-[12px] font-semibold transition ${
                        form[field.key]
                          ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-black/30 text-white/45"
                      }`}
                    >
                      {form[field.key] ? "Aktif" : "Pasif"}
                      <span
                        className={`relative h-4 w-7 rounded-full transition ${form[field.key] ? "bg-emerald-400/70" : "bg-white/15"}`}
                      >
                        <span
                          className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${
                            form[field.key] ? "left-3.5" : "left-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  ) : (
                    <input
                      id={`field-${field.key}`}
                      type={field.type === "number" ? "number" : "text"}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="input"
                    />
                  )}
                  {field.hint ? <p className="mt-1 text-[10px] text-white/30">{field.hint}</p> : null}
                </div>
              ))}
            </div>
            {error ? <p className="mt-3 text-[11.5px] text-pink-300">{error}</p> : null}
            <div className="mt-5 flex items-center gap-2">
              <button onClick={() => void submit()} disabled={saving} className="btn btn-primary flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editingId ? "Güncelle" : "Kaydet"}
              </button>
              <button onClick={() => setDrawerOpen(false)} className="btn btn-ghost">
                İptal
              </button>
            </div>
            <p className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[10px] leading-relaxed text-white/30">
              API: <code className="text-cyan-200/70">{editingId ? `PATCH /api/resources/${resource}/${editingId}` : `POST /api/resources/${resource}`}</code>
              <br />
              Tüm veriler PostgreSQL üzerinde Drizzle ORM ile saklanır.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
