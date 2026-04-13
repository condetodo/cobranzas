"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function ReanalyzarButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleReanalyze() {
    setLoading(true)
    try {
      await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "MANUAL" }),
      })
      router.refresh()
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReanalyze}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-1" />
      )}
      Reanalizar
    </Button>
  )
}
