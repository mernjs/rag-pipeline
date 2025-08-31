import GlobalSearch from "@/components/search/global-search"
import SearchResults from "@/components/search/search-results"
import AssistantPanel from "@/components/chat/assistant-panel"
import UploadPanel from "@/components/upload/upload-panel"
import SidebarStats from "@/components/stats/sidebar-stats"
import DatasetGrid from "@/components/datasets/dataset-grid"

export default function Page() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-7xl grid-rows-[auto_1fr] gap-4 p-4 md:p-6">
        {/* Top Bar: Title + Global Search */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary" aria-hidden />
            <h1 className="text-pretty text-xl font-semibold tracking-tight md:text-2xl">Knowledge Hub</h1>
          </div>
          <GlobalSearch />
        </header>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[260px_1fr]">
          {/* Sidebar: Sources/Collections */}
          <aside className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-sm font-medium">Sources & Collections</h2>
            </div>
            {/* Dynamic sidebar stats via /api/stats */}
            <SidebarStats />
          </aside>

          {/* Primary Columns */}
          <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
            {/* Results & Filters */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                <h2 className="text-sm font-medium">Results</h2>
                <div className="flex items-center gap-2">
                  <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
                    Filters
                  </button>
                  <button className="rounded-md bg-secondary px-3 py-1.5 text-xs text-secondary-foreground hover:opacity-90">
                    Save View
                  </button>
                </div>
              </div>
              <SearchResults />
            </div>

            {/* Conversational AI Panel */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                <h2 className="text-sm font-medium">Assistant</h2>
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">RAG Enabled</span>
              </div>
              <AssistantPanel />
            </div>

            {/* Ingestion / Upload */}
            <div className="rounded-lg border border-border bg-card lg:col-span-2">
              <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-sm font-medium">Upload & Ingestion</h2>
                <div className="flex items-center gap-2">
                  <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
                    Configure Pipeline
                  </button>
                  <button className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90">
                    New Upload
                  </button>
                </div>
              </div>
              <UploadPanel />
            </div>

            {/* Datasets / Versions */}
            <div className="rounded-lg border border-border bg-card lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-sm font-medium">Datasets</h2>
                <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
                  Manage
                </button>
              </div>
              {/* Dynamic dataset grid via /api/stats */}
              <div className="p-4">
                <DatasetGrid />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
