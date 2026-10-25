import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI SOFT STUDIO | WhatsApp Automation",
  description: "WhatsApp automation workspace for businesses, powered by the official Meta WhatsApp Business Platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
