import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracepoint | AI Support Incident Console",
  description: "A support engineering lab for reproducing, diagnosing, and escalating OpenAI API incidents."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
