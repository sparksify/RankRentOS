import "./globals.css";

export const metadata = { title: "RankRentOS", description: "Rank-and-rent market intelligence and pipeline OS" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
