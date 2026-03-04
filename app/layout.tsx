import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tolerance Stack-Up Analysis",
  description:
    "Statistical tolerance analysis tool for mechanical engineers — worst-case, RSS, DPPM & yield calculations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("ta-theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-white dark:bg-forest-950 text-navy-800 dark:text-forest-100 transition-colors">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
