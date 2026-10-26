import type { Metadata } from "next";
import "./globals.css";
import WebsiteChatWidget from "@/components/website-chat-widget";

export const metadata: Metadata = {
  title: "AI SOFT STUDIO | WhatsApp Automation",
  description: "WhatsApp automation workspace for businesses, powered by the official Meta WhatsApp Business Platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<WebsiteChatWidget /></body></html>;
}
