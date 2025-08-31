"use client"
import dynamic from "next/dynamic"

const ChatWithViewer = dynamic(() => import("@/components/chat/chat-with-viewer"), { ssr: false })

export default function Page() {
  return (
    <main className="container mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold text-balance">Chat</h1>
      <ChatWithViewer />
    </main>
  )
}
