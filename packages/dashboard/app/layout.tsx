export const metadata = {
  title: "DevDrip Dashboard",
  description: "earnings, analytics, preferences, wallet",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
