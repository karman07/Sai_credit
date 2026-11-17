import type { LoanCase, RTORecord } from "./api";

/** Client-side filter model for RTO files (a disbursed case + its RTO record, which may not exist yet). */
export interface RtoFilters {
  q: string;
  progress: string[];       // "Not started" | "In progress" | "Completed"
  status: string[];         // RTO status text, "Not started" when there's no record
  ownershipType: string[];
  checks: Record<string, string[]>; // checklist key -> chosen values (Pending / Received / Not Required)
  receiving: "" | "true" | "false";
  stage: string[];          // stage names…
  stageStatus: string[];    // …and the status they must be in (any chosen stage; any stage if none chosen)
  stageMode: "any" | "all"; // match when ANY chosen stage fits, or only when ALL chosen stages do
  currentStage: string[];   // the stage the file is waiting on (first stage not Done / NA), or "Not started" / "All stages done"
  owner: string[];          // RTO coordinator working the file
  requests: "" | "open" | "awaiting" | "resolved" | "none";
  slip: "" | "true" | "false";
  pendingDocs: "" | "true" | "false";
  approvalFrom: string; approvalTo: string;
  completedFrom: string; completedTo: string;
  disbursedFrom: string; disbursedTo: string;
  nocMin: string; nocMax: string;
  balMin: string; balMax: string;
  // case-level
  bank: string[]; dealer: string[]; product: string[]; rep: string[]; state: string[]; city: string[];
  custom: Record<string, string[]>; // custom RTO select/boolean fields from Form Builder
}

export const EMPTY_RTO_FILTERS: RtoFilters = {
  q: "", progress: [], status: [], ownershipType: [], checks: {}, receiving: "", stage: [], stageStatus: [], stageMode: "any", currentStage: [], owner: [],
  requests: "", slip: "", pendingDocs: "", approvalFrom: "", approvalTo: "", completedFrom: "", completedTo: "",
  disbursedFrom: "", disbursedTo: "", nocMin: "", nocMax: "", balMin: "", balMax: "",
  bank: [], dealer: [], product: [], rep: [], state: [], city: [], custom: {},
};

/** Checklist items on the RTO record, in display order. */
export const RTO_CHECKS: { key: string; label: string }[] = [
  { key: "rtoOwnership", label: "RTO ownership" },
  { key: "challanCheck", label: "Challan check" },
  { key: "bankNocCheck", label: "Bank NOC" },
  { key: "insuranceCheck", label: "Insurance check" },
  { key: "hypothecation", label: "Hypothecation" },
  { key: "aadhaarMatch", label: "Aadhaar match" },
];
export const CHECK_VALUES = ["Pending", "Received", "Not Required"];
export const STAGE_STATUS_VALUES = ["Pending", "In Progress", "Done", "NA"];

export const NOT_STARTED = "Not started";
export const ALL_DONE = "All stages done";

/** Stages of a file in catalog order. A file with no RTO record yet has no stages (every stage counts as Pending). */
export const orderedStages = (r?: RTORecord | null) => [...(r?.stages ?? [])].sort((a, b) => a.order - b.order);

/** The stage a file is currently waiting on: first stage (in order) that is neither Done nor NA. */
export function currentStageOf(r?: RTORecord | null): string {
  const st = orderedStages(r);
  if (!r || st.length === 0) return NOT_STARTED;
  return st.find((s) => s.status !== "Done" && s.status !== "NA")?.name ?? ALL_DONE;
}

export const progressOf = (r?: RTORecord | null): "Not started" | "In progress" | "Completed" => {
  if (!r) return "Not started";
  if (r.status === "Completed" || r.completedAt) return "Completed";
  const started = (r.stages ?? []).some((s) => s.status === "In Progress" || s.status === "Done");
  return started ? "In progress" : "Not started";
};

export function countRtoFilters(f: RtoFilters): number {
  const arrays = [f.progress, f.status, f.ownershipType, f.stage, f.stageStatus, f.currentStage, f.owner, f.bank, f.dealer, f.product, f.rep, f.state, f.city];
  let n = f.q.trim() ? 1 : 0;
  n += arrays.filter((a) => a.length).length;
  n += Object.values(f.checks).filter((a) => a.length).length + Object.values(f.custom).filter((a) => a.length).length;
  n += [f.receiving, f.requests, f.slip, f.pendingDocs].filter(Boolean).length;
  n += [[f.approvalFrom, f.approvalTo], [f.completedFrom, f.completedTo], [f.disbursedFrom, f.disbursedTo], [f.nocMin, f.nocMax], [f.balMin, f.balMax]]
    .filter(([a, b]) => a || b).length;
  return n;
}

const inRange = (v: string | undefined, from: string, to: string) => {
  if (!from && !to) return true;
  const d = v?.slice(0, 10);
  if (!d) return false;
  return (!from || d >= from) && (!to || d <= to);
};
const inNum = (v: number | undefined, min: string, max: string) => {
  if (!min && !max) return true;
  if (v === undefined || v === null) return false;
  return (min === "" || v >= Number(min)) && (max === "" || v <= Number(max));
};

/** Whether one RTO file (case + optional record) passes every active filter. */
export function matchesRto(c: LoanCase, r: RTORecord | null | undefined, f: RtoFilters): boolean {
  const a = r as any;
  const cu = c.customer;

  if (f.q.trim()) {
    const hay = [c.caseCode, cu.firstName, cu.lastName, cu.contact, cu.altContact, cu.location, c.regNumber, c.vehicleModel, c.bankName, c.dealerName,
      c.assignedToName, a?.rtoOwnerName, a?.remarks, (a?.pendingDocuments ?? []).join(" ")].filter(Boolean).join(" ").toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }

  if (f.progress.length && !f.progress.includes(progressOf(r))) return false;
  if (f.status.length && !f.status.includes(r?.status ?? "Not started")) return false;
  if (f.ownershipType.length && !f.ownershipType.includes(a?.rtoOwnershipType ?? "")) return false;
  for (const [key, chosen] of Object.entries(f.checks)) {
    if (chosen.length && !chosen.includes(a?.[key] ?? "Pending")) return false;
  }
  if (f.receiving && Boolean(a?.rtoReceiving) !== (f.receiving === "true")) return false;

  if (f.stage.length || f.stageStatus.length) {
    const stages = r?.stages ?? [];
    // A stage the file has no record of yet is simply Pending.
    const statusOf = (name: string) => stages.find((s) => s.name === name)?.status ?? "Pending";
    const fits = (name: string, status: string) => (!f.stageStatus.length || f.stageStatus.includes(status)) && (!f.stage.length || f.stage.includes(name));
    let hit: boolean;
    if (f.stage.length) {
      const test = (name: string) => fits(name, statusOf(name));
      hit = f.stageMode === "all" ? f.stage.every(test) : f.stage.some(test);
    } else {
      hit = stages.length ? stages.some((s) => fits(s.name, s.status)) : f.stageStatus.includes("Pending");
    }
    if (!hit) return false;
  }
  if (f.currentStage.length && !f.currentStage.includes(currentStageOf(r))) return false;
  if (f.owner.length && !f.owner.includes(a?.rtoOwnerName ?? "Unassigned")) return false;

  const reqs = r?.docRequests ?? [];
  if (f.requests === "open" && !reqs.some((x) => !x.isResolved)) return false;
  if (f.requests === "awaiting" && !reqs.some((x) => !x.isResolved && !x.response)) return false;
  if (f.requests === "resolved" && !(reqs.length > 0 && reqs.every((x) => x.isResolved))) return false;
  if (f.requests === "none" && reqs.length > 0) return false;

  if (f.slip && Boolean(a?.rtoSlipUrl) !== (f.slip === "true")) return false;
  if (f.pendingDocs && Boolean(a?.pendingDocuments?.length) !== (f.pendingDocs === "true")) return false;
  if (!inRange(a?.approvalDate, f.approvalFrom, f.approvalTo)) return false;
  if (!inRange(a?.completedAt, f.completedFrom, f.completedTo)) return false;
  if (!inRange(c.disbursementDate ?? c.createdAt, f.disbursedFrom, f.disbursedTo)) return false;
  if (!inNum(a?.nocHoldAmt, f.nocMin, f.nocMax)) return false;
  if (!inNum(a?.balancePayment, f.balMin, f.balMax)) return false;

  if (f.bank.length && !f.bank.includes(c.bankName ?? "")) return false;
  if (f.dealer.length && !f.dealer.includes(c.dealerName ?? "")) return false;
  if (f.product.length && !f.product.includes(c.product ?? "")) return false;
  if (f.rep.length && !f.rep.includes(c.assignedToName ?? "Unassigned")) return false;
  if (f.state.length && !f.state.includes(cu.state ?? "")) return false;
  if (f.city.length && !f.city.includes(cu.location ?? "")) return false;

  for (const [key, chosen] of Object.entries(f.custom)) {
    if (!chosen.length) continue;
    const v = a?.customFields?.[key];
    const val = typeof v === "boolean" ? (v ? "Yes" : "No") : v == null ? "" : String(v);
    if (!chosen.includes(val)) return false;
  }
  return true;
}
