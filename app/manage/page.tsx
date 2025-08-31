"use client"
import dynamic from "next/dynamic"

const UploadPanel = dynamic(() => import("@/components/upload/upload-panel"), { ssr: false })
const SettingsPanel = dynamic(() => import("@/components/settings/settings-panel"), { ssr: false })

export default function Page() {
  return (
    <main className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Manage</h1>
      <SettingsPanel />
      <div className="rounded border p-4">
        <h3 className="font-medium mb-3">New Upload</h3>
        <UploadPanel />
      </div>
    </main>
  )
}
