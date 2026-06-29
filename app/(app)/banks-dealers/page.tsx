"use client";

import { useEffect, useState } from "react";
import { Building2, Car, Phone, User, MapPin } from "lucide-react";
import { SearchInput, Badge, Tabs, EmptyState, Skeleton } from "../../../components/ui";
import { banksApi, dealersApi, type Bank, type Dealer } from "../../../lib/api";

export default function BanksDealersPage() {
  const [tab, setTab] = useState("banks");
  const [search, setSearch] = useState("");

  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [loadingDealers, setLoadingDealers] = useState(true);

  useEffect(() => {
    banksApi.list()
      .then((r) => setBanks(r.data.filter((b) => b.isActive)))
      .catch(() => setBanks([]))
      .finally(() => setLoadingBanks(false));
  }, []);

  useEffect(() => {
    dealersApi.list()
      .then((r) => setDealers(r.data.filter((d) => d.isActive)))
      .catch(() => setDealers([]))
      .finally(() => setLoadingDealers(false));
  }, []);

  const q = search.toLowerCase();
  const filteredBanks = banks.filter((b) =>
    !q || b.name.toLowerCase().includes(q) || (b.bmName ?? "").toLowerCase().includes(q) || (b.branch ?? "").toLowerCase().includes(q)
  );
  const filteredDealers = dealers.filter((d) =>
    !q || d.name.toLowerCase().includes(q) || (d.location ?? "").toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Bank & Dealer Directory</h1>
        <p className="text-sm text-muted mt-0.5">Reference contacts for banks, NBFCs, and dealer partners</p>
      </div>

      <div className="flex items-center gap-3">
        <Tabs
          tabs={[
            { id: "banks",   label: "Banks & NBFCs", count: banks.length },
            { id: "dealers", label: "Dealers",        count: dealers.length },
          ]}
          active={tab}
          onChange={(id) => { setTab(id); setSearch(""); }}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={tab === "banks" ? "Search banks…" : "Search dealers…"}
          className="w-56 ml-auto"
        />
      </div>

      {/* Banks */}
      {tab === "banks" && (
        loadingBanks ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : filteredBanks.length === 0 ? (
          <EmptyState icon={Building2} title="No banks found" description={search ? "Try a different search term." : "No active banks configured yet."} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBanks.map((b, i) => (
              <div
                key={b._id}
                className="card p-4 space-y-3 hover:shadow-md transition-shadow animate-fadeIn"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                      <Building2 className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{b.name}</p>
                      {b.branch && (
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{b.branch}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge tone="success" dot>Active</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-border">
                  <div>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1.5">Business Manager</p>
                    {b.bmName ? (
                      <>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <User className="size-3 text-muted shrink-0" />{b.bmName}
                        </p>
                        {b.bmContact && (
                          <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                            <Phone className="size-3 shrink-0" />{b.bmContact}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1.5">Executive</p>
                    {b.executive ? (
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <User className="size-3 text-muted shrink-0" />{b.executive}
                      </p>
                    ) : (
                      <p className="text-xs text-muted">—</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Dealers */}
      {tab === "dealers" && (
        loadingDealers ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : filteredDealers.length === 0 ? (
          <EmptyState icon={Car} title="No dealers found" description={search ? "Try a different search term." : "No active dealers configured yet."} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDealers.map((d, i) => (
              <div
                key={d._id}
                className="card p-4 space-y-3 hover:shadow-md transition-shadow animate-fadeIn"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-lg bg-success/10 grid place-items-center shrink-0">
                    <Car className="size-4 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{d.name}</p>
                    {d.location && (
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3 shrink-0" />{d.location}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border">
                  {d.contact && (
                    <p className="text-xs text-muted flex items-center gap-1.5">
                      <Phone className="size-3 shrink-0" />{d.contact}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
