import "./globals.css";

export const metadata = { title: "LeadGen Scout", description: "Rank-and-rent market intelligence" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
