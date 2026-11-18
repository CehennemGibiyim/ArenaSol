"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Gem, Percent, TrendingUp, Wallet } from "lucide-react";
import { ResourceManager } from "@/components/resource-manager";
import { Badge, Card, CardHeader, Progress } from "@/components/ui";
import { DIAMOND_RATE_TRY, DIAMOND_RATE_USD, formatMoney, formatNumber } from "@/lib/format";

type RevenueRow = {
  id: number;
  amount: number;
  diamonds: number;
  commission: number;
  status: string;
  source: string;
};

export function RevenueConsole({ creators }: { creators: Array<{ value: string; label: string }> }) {
  const [diamonds, setDiamonds] = useState(25000);
  const [commission, setCommission] = useState(20);
  const [rate, setRate] = useState(DIAMOND_RATE_TRY);
  const [rows, setRows] = useState<RevenueRow[]>([]);

  useEffect(() => {
    fetch("/api/resources/revenue?limit=200", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setRows((data.data ?? []) as RevenueRow[]))
      .catch(() => null);
  }, []);

  const gross = useMemo(() => diamonds * rate, [diamonds, rate]);
  const agencyShare = useMemo(() => (gross * commission) / 100, [gross, commission]);
  const creatorShare = gross - agencyShare;

  const totals = useMemo(() => {
    const paid = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.amount, 0);
    const pending = rows.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.amount, 0);
    const diamondsTotal = rows.reduce((sum, row) => sum + row.diamonds, 0);
    return { paid, pending, diamondsTotal };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Tahsil edilen", value: formatMoney(totals.paid), hint: "Ödemesi tamamlanan kayıtlar", icon: Wallet },
          { label: "Bekleyen", value: formatMoney(totals.pending), hint: "Mutabakat bekleyen tutar", icon: TrendingUp },
          { label: "Elmas hacmi", value: formatNumber(totals.diamondsTotal), hint: `${rows.length} gelir kaydı`, icon: Gem },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="panel p-4">
              <div className="flex items-center justify-between">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-white/35">{stat.label}</p>
                <Icon size={13} className="text-cyan-200/70" />
              </div>
              <p className="mt-2 text-[22px] font-bold leading-none tabular-nums text-white">{stat.value}</p>
              <p className="mt-1 text-[10px] text-white/35">{stat.hint}</p>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Elmas → gelir hesaplayıcı"
          subtitle="TikTok elmas kurunu ve ajans komisyonunu ayarla, net dağılımı gör"
          icon={<Calculator size={14} />}
          action={<Badge tone="cyan">1 💎 ≈ {formatMoney(Math.round(gross / Math.max(diamonds, 1)))}</Badge>}
        />
        <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label" htmlFor="diamonds">
                Elmas
              </label>
              <input
                id="diamonds"
                type="number"
                value={diamonds}
                onChange={(event) => setDiamonds(Math.max(0, Number(event.target.value) || 0))}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="rate">
                Kur (TL / elmas)
              </label>
              <input
                id="rate"
                type="number"
                step="0.001"
                value={rate}
                onChange={(event) => setRate(Math.max(0, Number(event.target.value) || 0))}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="commission">
                Komisyon %
              </label>
              <input
                id="commission"
                type="number"
                value={commission}
                onChange={(event) => setCommission(Math.min(80, Math.max(0, Number(event.target.value) || 0)))}
                className="input"
              />
            </div>
            <div className="col-span-3 mt-1 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
              {[12500, 25000, 50000, 100000, 250000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDiamonds(preset)}
                  className={`rounded-lg border px-2 py-1.5 font-semibold transition ${
                    diamonds === preset
                      ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"
                  }`}
                >
                  {formatNumber(preset)} 💎
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-black/25 p-3.5">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] text-white/45">Brüt gelir</p>
              <p className="text-[19px] font-bold tabular-nums text-white">{formatMoney(gross)}</p>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] text-white/45">Ajans payı (%{commission})</p>
              <p className="text-[14px] font-semibold tabular-nums text-violet-200">{formatMoney(agencyShare)}</p>
            </div>
            <div className="flex items-baseline justify-between border-t border-white/[0.07] pt-2">
              <p className="text-[11px] text-white/45">Yayıncıya kalan</p>
              <p className="text-[18px] font-bold tabular-nums text-emerald-300">{formatMoney(creatorShare)}</p>
            </div>
            <Progress value={creatorShare} max={Math.max(gross, 1)} tone="emerald" height={7} />
            <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
              <div className="panel-flat p-2">
                <p className="text-white/30">USD karşılığı</p>
                <p className="mt-0.5 text-[12px] font-semibold text-white/80">
                  ${(diamonds * DIAMOND_RATE_USD).toFixed(2)}
                </p>
              </div>
              <div className="panel-flat p-2">
                <p className="flex items-center gap-1 text-white/30">
                  <Percent size={9} /> Vergi öncesi
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-white/80">{formatMoney(gross)}</p>
              </div>
            </div>
            <p className="text-[9.5px] leading-relaxed text-white/25">
              Oranlar tahminidir; TikTok ödeme kuralları ülkeye ve döneme göre değişir. Muhasebe kayıtlarını kendi
              mutabakatınızla güncelleyin.
            </p>
          </div>
        </div>
      </Card>

      <ResourceManager
        resource="revenue"
        title="Gelir kayıtları"
        subtitle="Hediye, marka ve abonelik gelirlerini dönem bazında takip et"
        createLabel="Gelir ekle"
        searchPlaceholder="Kaynak ara..."
        fields={[
          { key: "creatorId", label: "Yayıncı", type: "select", options: [{ value: "", label: "Toplu / ağ geliri" }, ...creators] },
          { key: "source", label: "Kaynak", type: "select", half: true, options: ["hediye", "marka", "abonelik", "bonus"] },
          { key: "status", label: "Durum", type: "select", half: true, options: ["pending", "paid"] },
          { key: "amount", label: "Tutar (TRY)", type: "number", half: true, required: true, defaultValue: 0 },
          { key: "diamonds", label: "Elmas", type: "number", half: true, defaultValue: 0 },
          { key: "commission", label: "Komisyon %", type: "number", half: true, defaultValue: 20 },
          { key: "currency", label: "Para birimi", type: "select", half: true, options: ["TRY", "USD", "EUR"] },
          { key: "period", label: "Dönem", type: "text", half: true, placeholder: "2026-06" },
          { key: "note", label: "Not", type: "text", half: true },
        ]}
        columns={[
          { key: "source", label: "Kaynak", format: "badge" },
          { key: "amount", label: "Tutar", format: "money" },
          { key: "diamonds", label: "Elmas", format: "number" },
          { key: "commission", label: "Komisyon", format: "number" },
          { key: "status", label: "Durum", format: "badge" },
          { key: "period", label: "Dönem" },
          { key: "createdAt", label: "Tarih", format: "date" },
        ]}
        filters={[
          {
            key: "status",
            label: "Durum",
            options: [
              { value: "paid", label: "Ödendi" },
              { value: "pending", label: "Bekliyor" },
            ],
          },
        ]}
      />
    </div>
  );
}
