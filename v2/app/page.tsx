/**
 * Phase-1 shell. Static status page only — real screens arrive Phase 9
 * (slices during Phase 6). Convex client wiring lands with the first
 * screen that reads live data, once a Convex deployment exists.
 */
export default function Overview() {
  const phases: Array<[string, string]> = [
    ["Phase 1 — Foundation + evidence spine", "current"],
    ["Phase 2 — V0 import + collector migration", "pending approval"],
    ["Phase 3 — Related keywords + operators", "planned"],
    ["Phase 4 — Deterministic scoring (A–I)", "planned"],
    ["Phase 5 — AI research layer (provider-neutral)", "planned"],
    ["Phase 6 — Discovery funnel", "planned"],
    ["Phase 7 — North Texas cluster", "planned"],
    ["Phase 8 — Portfolio selection", "planned"],
  ];
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>RankRent OS V2</h1>
      <p style={{ color: "#8b93a7", marginTop: 0 }}>
        The smallest engine that can make a better first 20-asset investment
        decision than manual analysis.
      </p>
      <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
        {phases.map(([label, status]) => (
          <li key={label}>
            <span style={{ color: status === "current" ? "#4ade80" : "#8b93a7" }}>
              {status === "current" ? "●" : "○"}
            </span>{" "}
            {label}{" "}
            <span style={{ color: "#5b6272", fontSize: 13 }}>({status})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
