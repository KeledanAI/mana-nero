import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Mana Nero Fumetteria — Tradate",
    template: "%s · Mana Nero Fumetteria",
  },
  description:
    "Fumetti, giochi di carte collezionabili, giochi da tavolo ed eventi. Il cuore ludico di Tradate.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(223 22% 16%)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
