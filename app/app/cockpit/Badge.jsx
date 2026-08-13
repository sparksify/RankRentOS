const MAP = {
  PASS: ["b-pass", "Pass"],
  PASS_WITH_WARNING: ["b-warn", "Pass w/ warning"],
  NEEDS_REVIEW: ["b-review", "Needs review"],
  FAIL: ["b-fail", "Fail"],
};
export default function Badge({ status, label }) {
  const [cls, text] = MAP[status] || ["b-neutral", status];
  return <span className={`badge ${cls}`}>{label || text}</span>;
}
