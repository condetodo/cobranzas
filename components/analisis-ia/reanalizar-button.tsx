"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { ReanalyzeDialog } from "./reanalyze-dialog"

export function ReanalyzarButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RefreshCw className="h-4 w-4 mr-1" />
        Reanalizar
      </Button>
      <ReanalyzeDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
