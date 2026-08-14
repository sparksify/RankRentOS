"use client";
import { useState } from "react";

export default function Tabs({ labels, children }) {
  const [on, setOn] = useState(0);
  const kids = Array.isArray(children) ? children : [children];
  return (
    <>
      <div className="tabs" role="tablist">
        {labels.map((l, i) => (
          <button key={l} role="tab" aria-selected={on === i} className={on === i ? "on" : ""} onClick={() => setOn(i)}>{l}</button>
        ))}
      </div>
      {kids.map((k, i) => (
        <div key={i} role="tabpanel" hidden={on !== i}>{k}</div>
      ))}
    </>
  );
}
