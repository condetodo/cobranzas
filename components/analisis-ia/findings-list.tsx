"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, AlertTriangle, Info } from "lucide-react"

interface Finding {
  text: string
  severity: string
}

const SEVERITY_CONFIG: Record<
  string,
  { icon: typeof Info; badgeClass: string; label: string }
> = {
  info: {
    icon: Info,
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    label: "Info",
  },
  warning: {
    icon: AlertTriangle,
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
    label: "Alerta",
  },
  critical: {
    icon: AlertCircle,
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    label: "Critico",
  },
}

export function FindingsList({ findings }: { findings: Finding[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Hallazgos del agente IA</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {findings.map((finding, i) => {
            const cfg =
              SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.info
            const Icon = cfg.icon
            return (
              <li key={i} className="flex items-start gap-3">
                <Icon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className={cfg.badgeClass}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {finding.text}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
