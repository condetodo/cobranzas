"use client"

import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"

const BUCKET_OPTIONS = [
  { value: "ALL", label: "Todos los segmentos" },
  { value: "SIN_VENCER", label: "Sin vencer" },
  { value: "SUAVE", label: "Suave" },
  { value: "FIRME", label: "Firme" },
  { value: "AVISO_FINAL", label: "Aviso final" },
  { value: "CRITICO", label: "Critico" },
]

interface DebtorFiltersProps {
  search: string
  onSearchChange: (val: string) => void
  bucket: string
  onBucketChange: (val: string) => void
  autopilotOffOnly: boolean
  onAutopilotOffChange: (val: boolean) => void
}

export function DebtorFilters({
  search,
  onSearchChange,
  bucket,
  onBucketChange,
  autopilotOffOnly,
  onAutopilotOffChange,
}: DebtorFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-white p-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por razon social..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Bucket filter */}
      <Select value={bucket} onValueChange={onBucketChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Segmento" />
        </SelectTrigger>
        <SelectContent>
          {BUCKET_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Autopilot off only */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="autopilot-off"
          checked={autopilotOffOnly}
          onCheckedChange={(val) => onAutopilotOffChange(val === true)}
        />
        <Label htmlFor="autopilot-off" className="text-sm cursor-pointer">
          Solo autopilot off
        </Label>
      </div>
    </div>
  )
}
