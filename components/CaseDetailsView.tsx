"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Badge, CaseStatusBadge } from "./ui";
import { api, fileUrl, type LoanCase } from "../lib/api";
import { loadCustomDefs, type CustomDef } from "../lib/exportSheets";
import { coreFields } from "../lib/coreFields";
import { useFormSchema } from "../lib/useFormSchema";

const money = (n?: number) => (n || n === 0 ? `₹${n.toLocaleString("en-IN")}` : "—");
const date = (d?: string) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const yesNo = (v?: boolean) => (v === undefined ? "—" : v ? "Yes" : "No");
const text = (v?: string | number | null) => (v === undefined || v === null || v === "" ? "—" : String(v));

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{title}</p>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3 rounded-lg border border-border bg-surface p-3.5">{children}</dl>
    </section>
  );
}
function Item({ label, children, wide, k, cf }: { label: string; children: React.ReactNode; wide?: boolean; k?: string; cf?: ReturnType<typeof coreFields> }) {
  // Fields hidden in Form Builder are hidden here too; renamed fields show their Form Builder label.
  if (k && cf && !cf.show(k)) return null;
  return (
    <div className={wide ? "col-span-full" : ""}>
      <dt className="text-[11px] text-muted">{k && cf ? cf.label(k, label) : label}</dt>
      <dd className="text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/**
 * Everything known about a case, read-only: customer, vehicle, loan, bank & dealer, people, pipeline,
 * documents and every Form Builder custom field. Used wherever someone works a case without owning it
 * (RTO coordinators, the RTO tracker, sales RTO status).
 */
export function CaseDetailsView({ c }: { c: LoanCase }) {
  const [defs, setDefs] = useState<CustomDef[]>([]);
  const cf = coreFields(useFormSchema("new-case"));
  useEffect(() => { loadCustomDefs("case").then((d) => setDefs(d.filter((x) => !x.core))); }, []);

  const [activity, setActivity] = useState<{ _id: string; type: string; description: string; note?: string; createdByName?: string; createdAt: string }[]>([]);
  useEffect(() => {
    let live = true;
    api.get<any[]>(`/activities/case/${c._id}`).then((r) => { if (live) setActivity(r.data ?? []); }).catch(() => { if (live) setActivity([]); });
    return () => { live = false; };
  }, [c._id]);

  const custom = c.customFields ?? {};
  const keys = [...new Set([...defs.filter((d) => d.active).map((d) => d.key), ...Object.keys(custom)])]
    .filter((k) => custom[k] !== undefined && custom[k] !== null && custom[k] !== "")
    .filter((k) => defs.find((d) => d.key === k)?.active !== false); // hidden in Form Builder -> hidden here
  const label = (k: string) => defs.find((d) => d.key === k)?.label ?? k;
  const cu = c.customer;
  const anyC = c as any;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-primary">{c.caseCode}</span>
        <CaseStatusBadge status={c.status} />
        <Badge tone="neutral">{c.product}</Badge>
        {c.firm && <Badge tone="neutral">{c.firm}</Badge>}
      </div>

      <Block title="Customer">
        <Item label="Name" k="firstName" cf={cf}>{text(`${cu.firstName ?? ""} ${cu.lastName ?? ""}`.trim())}</Item>
        <Item label="Father's name" k="fatherName" cf={cf}>{text(cu.fatherName)}</Item>
        <Item label="Phone" k="contact" cf={cf}>{text(cu.contact)}</Item>
        <Item label="Alternate phone" k="altContact" cf={cf}>{text(cu.altContact)}</Item>
        <Item label="City" k="location" cf={cf}>{text(cu.location)}</Item>
        <Item label="State" k="state" cf={cf}>{text(cu.state)}</Item>
        <Item label="District">{text(cu.district)}</Item>
        <Item label="Pin code">{text(cu.pinCode)}</Item>
        <Item label="Residential status" k="residentialStatus" cf={cf}>{text(cu.residentialStatus)}</Item>
        <Item label="E-bill owner" k="ebillOwner" cf={cf}>{yesNo(cu.ebillOwner)}</Item>
      </Block>

      <Block title="Vehicle">
        <Item label="Vehicle model" k="vehicleModel" cf={cf}>{text(c.vehicleModel)}</Item>
        <Item label="Registration no." k="regNumber" cf={cf}>{text(c.regNumber)}</Item>
        <Item label="Owner serial" k="ownerSerial" cf={cf}>{text(c.ownerSerial)}</Item>
        <Item label="Existing insurer" k="existingInsurer" cf={cf}>{text(c.existingInsurer)}</Item>
        <Item label="Hypothecation" k="hypothecation" cf={cf}>{yesNo(c.hypothecation)}</Item>
        <Item label="NOC required" k="nocRequired" cf={cf}>{yesNo(c.nocRequired)}</Item>
        <Item label="Challans" k="challanCount" cf={cf}>{text(c.challanCount)}</Item>
        <Item label="Loan type" k="loanType" cf={cf}>{text(c.loanType)}</Item>
      </Block>

      <Block title="Loan, bank & dealer">
        <Item label="Loan amount" k="loanAmount" cf={cf}>{money(c.loanAmount)}</Item>
        <Item label="Disbursed on">{date(c.disbursementDate)}</Item>
        <Item label="Payout %" k="payoutPct" cf={cf}>{text(c.payoutPct)}</Item>
        <Item label="Bank / NBFC" k="bank" cf={cf}>{text(c.bankName)}</Item>
        <Item label="Branch" k="branch" cf={cf}>{text(c.bankBranch)}</Item>
        <Item label="Bank executive" k="executive" cf={cf}>{text(c.bankExecutive)}</Item>
        <Item label="BM name" k="bmName" cf={cf}>{text(c.bmName)}</Item>
        <Item label="BM contact" k="bmContact" cf={cf}>{text(c.bmContact)}</Item>
        <Item label="Dealer" k="dealer" cf={cf}>{text(c.dealerName)}</Item>
      </Block>

      <Block title="People & timeline">
        <Item label="Sales rep">{text(c.assignedToName)}</Item>
        <Item label="Coordinator">{text(anyC.coordinatorName)}</Item>
        <Item label="Case date">{date(c.date)}</Item>
        <Item label="Created">{date(c.createdAt)}</Item>
        <Item label="Remarks" wide>{text(c.remarks)}</Item>
      </Block>

      {keys.length > 0 && (
        <Block title="Additional details">
          {keys.map((k) => {
            const v = custom[k];
            const isFile = typeof v === "string" && v.startsWith("/uploads/");
            return (
              <Item key={k} label={label(k)}>
                {isFile
                  ? <a href={fileUrl(v)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3" /> View file</a>
                  : typeof v === "object" ? JSON.stringify(v) : String(v)}
              </Item>
            );
          })}
        </Block>
      )}

      {(c.pipeline ?? []).length > 0 && (
        <section className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Pipeline</p>
          <div className="rounded-lg border border-border bg-surface divide-y divide-border">
            {c.pipeline!.map((p) => (
              <div key={p.stage} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
                <span className="font-medium">{p.stage}</span>
                <span className="text-xs text-muted truncate">{p.status === "Done" ? `Done${p.doneByName ? ` by ${p.doneByName}` : ""}${p.doneAt ? ` · ${date(p.doneAt)}` : ""}` : p.status}{p.remarks ? ` — ${p.remarks}` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Documents ({(c.documents ?? []).length})</p>
        {(c.documents ?? []).length === 0 ? <p className="text-sm text-muted">No documents uploaded.</p> : (
          <div className="rounded-lg border border-border bg-surface divide-y divide-border">
            {c.documents.map((d) => (
              <a key={d._id} href={d.url ? fileUrl(d.url) : undefined} target="_blank" rel="noreferrer"
                 className="flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-surface-2">
                <FileText className="size-4 text-muted shrink-0" />
                <span className="font-medium">{d.docType}</span>
                <span className="text-muted truncate">{d.fileName}{d.remarks ? ` — ${d.remarks}` : ""}</span>
                <span className="ml-auto text-[11px] text-muted shrink-0">{d.uploadedByName} · {date(d.uploadedAt)}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Document requests ({(c.docRequests ?? []).length})</p>
        {(c.docRequests ?? []).length === 0 ? <p className="text-sm text-muted">No document requests.</p> : (
          <div className="rounded-lg border border-border bg-surface divide-y divide-border">
            {c.docRequests.map((r) => (
              <div key={r._id} className="px-3.5 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.docTypes.join(", ")}</span>
                  <Badge tone={r.isResolved ? "success" : "warning"}>{r.isResolved ? "Resolved" : "Open"}</Badge>
                  <span className="ml-auto text-[11px] text-muted shrink-0">{r.requestedByName} · {date(r.requestedAt)}</span>
                </div>
                {r.remarks && <p className="text-xs text-muted mt-0.5 whitespace-pre-wrap">{r.remarks}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Activity history ({activity.length})</p>
        {activity.length === 0 ? <p className="text-sm text-muted">No activity recorded.</p> : (
          <div className="rounded-lg border border-border bg-surface divide-y divide-border max-h-72 overflow-y-auto">
            {activity.map((a) => (
              <div key={a._id} className="px-3.5 py-2 text-sm">
                <p>{a.description}</p>
                {a.note && <p className="text-xs text-muted whitespace-pre-wrap">{a.note}</p>}
                <p className="text-[11px] text-muted">{a.createdByName ?? "System"} · {new Date(a.createdAt).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
