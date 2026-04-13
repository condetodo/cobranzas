"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampaignModal } from "./campaign-modal"
import { Rocket } from "lucide-react"

interface Action {
  title: string
  description: string
  targetSegment: string
  templateCode: string
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
            {actions.map((action, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{action.title}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {action.targetSegment}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setSelectedAction(action)}
                >
                  <Rocket className="h-4 w-4 mr-1" />
                  Ejecutar campana
                </Button>
              </div>
            ))}
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
