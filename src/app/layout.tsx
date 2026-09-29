import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Aflora — Finanças a dois, com clareza",
    template: "%s | Aflora",
  },
  description:
    "Um espaço financeiro compartilhado para cuidar do presente e planejar o futuro juntos.",
};

export const viewport: Viewport = {
  themeColor: "#F6F9F7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
