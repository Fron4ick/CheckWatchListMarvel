import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// Публичный адрес статического сайта (Yandex Cloud Object Storage).
const SITE_URL = "https://marvel-timeline-board.website.yandexcloud.net";

export const metadata: Metadata = {
  title: "Marvel Timeline Board — карта киновселенной",
  description:
    "Интерактивная карта фильмов Marvel: исследуйте фазы, добавляйте фото, заметки и связи.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Marvel Timeline Board",
    description: "Вся киновселенная на одной интерактивной карте.",
    url: SITE_URL,
    images: [
      { url: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: "Marvel Timeline Board" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${SITE_URL}/og.png`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
