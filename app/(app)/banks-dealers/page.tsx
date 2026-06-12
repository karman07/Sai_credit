"use client";

import { useState } from "react";
import { Building2, Car, Phone, User, MapPin } from "lucide-react";
import { SearchInput, Badge, Tabs } from "../../../components/ui";

const BANKS = [
  { id: "b1", name: "HDFC Bank",       branch: "Main Branch, Delhi",     bm: "Rohit Verma",  bmContact: "+91 98765 43210", executive: "Neha Joshi",   status: "active" as const },
  { id: "b2", name: "Kotak Mahindra",  branch: "Bandra West, Mumbai",    bm: "Sunita Patel", bmContact: "+91 87654 32109", executive: "Vivek Sharma", status: "active" as const },
  { id: "b3", name: "Axis Bank",       branch: "Koregaon Park, Pune",    bm: "Anil Kumar",   bmContact: "+91 76543 21098", executive: "Pooja Singh",  status: "active" as const },
  { id: "b4", name: "ICICI Bank",      branch: "Whitefield, Bangalore",  bm: "Priya Nair",   bmContact: "+91 65432 10987", executive: "Rahul Gupta",  status: "active" as const },
  { id: "b5", name: "SBI",             branch: "Banjara Hills, Hyderabad", bm: "Suresh Rao", bmContact: "+91 54321 09876", executive: "Deepa Reddy", status: "active" as const },
  { id: "b6", name: "IDFC First Bank", branch: "Anna Salai, Chennai",    bm: "Kiran Bose",   bmContact: "+91 43210 98765", executive: "Tanya Mehta",  status: "active" as const },
];

const DEALERS = [
  { id: "d1", name: "Sunrise Motors",    contact: "+91 98765 43210", location: "Delhi",     note: "Specializes in SUVs and sedans" },
  { id: "d2", name: "Galaxy Auto Sales", contact: "+91 87654 32109", location: "Mumbai",    note: "Large inventory of hatchbacks" },
  { id: "d3", name: "Prime Vehicles",    contact: "+91 76543 21098", location: "Pune",      note: "Commercial vehicles specialist" },
  { id: "d4", name: "Star Cars Pvt Ltd", contact: "+91 65432 10987", location: "Bangalore", note: "Luxury and premium segment" },
  { id: "d5", name: "Royal Auto Hub",    contact: "+91 54321 09876", location: "Hyderabad", note: "Budget cars and two-wheelers" },
];

export default function BanksDealersPage() {
  const [tab, setTab] = useState("banks");
  const [search, setSearch] = useState("");

  const filteredBanks = BANKS.filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.bm.toLowerCase().includes(search.toLowerCase()));
  const filteredDealers = DEALERS.filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.location.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Bank & Dealer Directory</h1>
        <p className="text-sm text-muted mt-0.5">Reference contacts for banks, NBFCs, and dealer partners</p>
      </div>

      <div className="flex items-center gap-3">
        <Tabs tabs={[{ id: "banks", label: "Banks & NBFCs", count: BANKS.length }, { id: "dealers", label: "Dealers", count: DEALERS.length }]} active={tab} onChange={setTab} />
        <SearchInput value={search} onChange={setSearch} placeholder={`Search ${tab}…`} className="w-56 ml-auto" />
      </div>

      {tab === "banks" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBanks.map((b, i) => (
            <div key={b.id} className="card p-4 space-y-3 animate-fadeIn hover:shadow-md transition-shadow" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-lg bg-primary-subtle grid place-items-center">
                    <Building2 className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{b.name}</p>
                    <p className="text-xs text-muted flex items-center gap-1">
                      <MapPin className="size-3" /> {b.branch}
                    </p>
                  </div>
                </div>
                <Badge tone="success" dot>Active</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1">Business Manager</p>
                  <p className="text-sm font-medium flex items-center gap-1.5"><User className="size-3 text-muted" />{b.bm}</p>
                  <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5"><Phone className="size-3" />{b.bmContact}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1">Executive</p>
                  <p className="text-sm font-medium">{b.executive}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "dealers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDealers.map((d, i) => (
            <div key={d.id} className="card p-4 space-y-3 animate-fadeIn hover:shadow-md transition-shadow" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-lg bg-success-subtle grid place-items-center">
                  <Car className="size-4 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{d.name}</p>
                  <p className="text-xs text-muted flex items-center gap-1"><MapPin className="size-3" />{d.location}</p>
                </div>
              </div>
              <p className="text-xs text-foreground-secondary">{d.note}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted border-t border-border pt-2">
                <Phone className="size-3" /> {d.contact}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
