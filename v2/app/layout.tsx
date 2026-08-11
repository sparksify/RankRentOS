import type { ReactNode } from "react";

export const metadata = {
  title: "RankRent OS V2",
  description:
    "Research + data + discovery + scoring + experiment-selection engine",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          margin: 0,
          background: "#0b0e14",
          color: "#e6e8ee",
        }}
      >
        {children}
      </body>
    </html>
  );
}
