"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Badge from "../Badge";

const COLS = [
  ["newRank", "#"], ["service", "Service"], ["geography", "Geography"], ["cohort", "Cohort"],
  ["gate", "Pre-purchase"], ["intent", "Intent"], ["organicV1", "Organic"], ["dimensionA", "A"],
  ["assetValueF", "F"], ["renterDepthE", "E"], ["measuredVolume", "Vol/mo"],
  ["expansion", "Expansion"], ["pages", "Pages"], ["leadValue", "Lead $"], ["confidence", "Conf"],
];

export default function Table({ rows }) {
  const [sort, setSort] = useState("newRank");
  const [dir, setDir] = useState(1);
  const [cohort, setCohort] = useState("ALL");
  const [gate, setGate] = useState("ALL");
  const [q, setQ] = useState("");

  const view = useMemo(() => {
    let r = rows.filter((x) =>
      (cohort === "ALL" || x.cohort === cohort) &&
      (gate === "ALL" || x.gate === gate) &&
      (!q || `${x.service} ${x.geography} ${x.state}`.toLowerCase().includes(q.toLowerCase())));
    r = [...r].sort((a, b) => {
      const A = a[sort], B = b[sort];
      if (A === null || A === undefined) return 1;
      if (B === null || B === undefined) return -1;
      return typeof A === "number" ? (A - B) * dir : String(A).localeCompare(String(B)) * dir;
    });
    return r;
  }, [rows, sort, dir, cohort, gate, q]);

  const cohorts = [...new Set(rows.map((r) => r.cohort))];
  const click = (k) => { if (sort === k) setDir(-dir); else { setSort(k); setDir(k === "newRank" ? 1 : -1); } };

  return (
    <>
      <div className="toolbar">
        <input placeholder="Search service or place…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
        <select value={cohort} onChange={(e) => setCohort(e.target.value)}>
          <option value="ALL">All cohorts</option>
          {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={gate} onChange={(e) => setGate(e.target.value)}>
          <option value="ALL">All gate statuses</option>
          <option value="PASS">Pass</option><option value="PASS_WITH_WARNING">Pass w/ warning</option>
          <option value="NEEDS_REVIEW">Needs review</option><option value="FAIL">Fail</option>
        </select>
        <span className="count">{view.length} of {rows.length}</span>
      </div>

      <div className="tablewrap"><table className="grid">
        <thead><tr>{COLS.map(([k, l]) => (
          <th key={k} onClick={() => click(k)} style={{ cursor: "pointer" }}>
            {l}{sort === k ? (dir === 1 ? " ↑" : " ↓") : ""}
          </th>))}</tr></thead>
        <tbody>
          {view.map((r) => (
            <tr key={r.id}>
              <td className="rank">{r.newRank}</td>
              <td><Link href={`/cockpit/opportunity/${r.id}`}><b>{r.service}</b></Link></td>
              <td>{r.geography}, {r.state}<div className="dim" style={{ fontSize: 11 }}>{({"master-planned-community":"community","city-control":"control"})[r.geographyType] || r.geographyType}</div></td>
              <td className="dim" style={{ fontSize: 11.5 }}>{r.cohort.replace(/^[A-Z0-9]+-/, "").replace("NTX-", "")}</td>
              <td><Badge status={r.gate} /></td>
              <td style={{ fontSize: 11.5 }} className={r.intent === "LOCAL_COMMERCIAL" ? "" : "dim"}>{r.intent.replace(/_/g, " ").toLowerCase()}</td>
              <td className="numc">{r.organicV1 ?? "—"}</td>
              <td className="numc dim">{r.dimensionA ?? "—"}</td>
              <td className="numc">{r.assetValueF ?? "—"}</td>
              <td className="numc">{r.renterDepthE ?? "—"}</td>
              <td className="numc">{r.measuredVolume === 0 ? <span className="dim">0*</span> : (r.measuredVolume ?? "—")}</td>
              <td className="numc">{r.expansion ?? "—"}</td>
              <td className="numc dim">{r.pages ?? "—"}</td>
              <td className="numc">{r.leadValue ? `$${r.leadValue.toLocaleString()}` : "—"}</td>
              <td className="numc dim">{r.confidence ?? "—"}</td>
            </tr>))}
        </tbody>
      </table></div>
      <p className="note" style={{ marginTop: 10 }}>
        <b>0*</b> = keyword tools report zero volume. For community assets that is the hypothesis under test, not a measurement of no demand.
        Click any row for the full investment memo.
      </p>
    </>
  );
}
