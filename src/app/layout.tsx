import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { MotionProvider } from "@/components/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShopSense — your Ring camera, now a business advisor",
  description:
    "ShopSense turns a small shop's existing Ring cameras into plain-language business advice: busy hours, how many visitors buy, and which supplier deliveries are hurting sales.",
};

export const viewport: Viewport = {
  themeColor: "#111113",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <MotionProvider>
            {children}
            <Toaster position="bottom-center" />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
