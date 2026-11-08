import type { Metadata } from "next";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/400-italic.css";
import "@fontsource/libre-baskerville/700.css";
import "@fontsource-variable/outfit/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoldOut",
  description: "Every seat filled by the people families already trust.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
