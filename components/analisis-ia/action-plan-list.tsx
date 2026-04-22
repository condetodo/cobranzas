"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampaignModal } from "./campaign-modal"
import { BUCKET_CONFIG } from "@/lib/bucket-colors"
import { Rocket } from "lucide-react"
import type { Bucket } from "@prisma/client"

export interface Action {
  title: string
  description: string
  targetBucket: Bucket
  templateCode: "soft" | "firm" | "final"
  estimatedRecovery?: number
}

export function ActionPlanList({ actions }: { actions: Action[] }) {
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Plan de accion recomendado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {actions.map((action, i) => {
              const cfg = BUCKET_CONFIG[action.targetBucket]
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{action.title}</p>
                      <Badge variant="outline" className={cfg.bgClass}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setSelectedAction(action)}>
                    <Rocket className="h-4 w-4 mr-1" />
                    Ejecutar campana
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <CampaignModal
        action={selectedAction}
        onClose={() => setSelectedAction(null)}
      />
    </>
  )
}
