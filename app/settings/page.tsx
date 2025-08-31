"use client"
import dynamic from "next/dynamic"
const SettingsPanel = dynamic(() => import("@/components/settings/settings-panel"), { ssr: false })

export default function Page() {
  return (
    <main className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsPanel />
    </main>
  )
}
