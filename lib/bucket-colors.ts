import type { Bucket } from "@prisma/client"

export const BUCKET_CONFIG: Record<
  Bucket,
  { label: string; color: string; bgClass: string; textClass: string }
> = {
  SIN_VENCER: {
    label: "Sin vencer",
    color: "emerald",
    bgClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    textClass: "text-emerald-700",
  },
  SUAVE: {
    label: "Suave",
    color: "yellow",
    bgClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
    textClass: "text-yellow-700",
  },
  FIRME: {
    label: "Firme",
    color: "orange",
    bgClass: "bg-orange-100 text-orange-800 border-orange-200",
    textClass: "text-orange-700",
  },
  AVISO_FINAL: {
    label: "Aviso final",
    color: "red",
    bgClass: "bg-red-100 text-red-800 border-red-200",
    textClass: "text-red-700",
  },
  CRITICO: {
    label: "Critico",
    color: "rose",
    bgClass: "bg-rose-200 text-rose-900 border-rose-300",
    textClass: "text-rose-900",
  },
}
