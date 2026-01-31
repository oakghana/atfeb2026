import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  variant?: "default" | "success" | "warning" | "error"
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatsCard({ title, value, description, icon: Icon, variant = "default", trend, className }: StatsCardProps) {
  const variantStyles = {
    default: "bg-gradient-to-br from-white/80 via-white/60 to-white/40 dark:from-slate-900/80 dark:via-slate-800/60 dark:to-slate-700/40 backdrop-blur-xl border-white/20 dark:border-slate-700/20",
    success: "bg-gradient-to-br from-emerald-50/80 via-emerald-100/60 to-emerald-200/40 dark:from-emerald-950/80 dark:via-emerald-900/60 dark:to-emerald-800/40 backdrop-blur-xl border-emerald-200/50 dark:border-emerald-800/50",
    warning: "bg-gradient-to-br from-amber-50/80 via-amber-100/60 to-amber-200/40 dark:from-amber-950/80 dark:via-amber-900/60 dark:to-amber-800/40 backdrop-blur-xl border-amber-200/50 dark:border-amber-800/50",
    error: "bg-gradient-to-br from-red-50/80 via-red-100/60 to-red-200/40 dark:from-red-950/80 dark:via-red-900/60 dark:to-red-800/40 backdrop-blur-xl border-red-200/50 dark:border-red-800/50",
  }

  const iconStyles = {
    default: "text-slate-600 dark:text-slate-300",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
  }

  const iconBgStyles = {
    default: "bg-gradient-to-br from-slate-100/80 to-slate-200/60 dark:from-slate-800/80 dark:to-slate-700/60",
    success: "bg-gradient-to-br from-emerald-100/80 to-emerald-200/60 dark:from-emerald-900/80 dark:to-emerald-800/60",
    warning: "bg-gradient-to-br from-amber-100/80 to-amber-200/60 dark:from-amber-900/80 dark:to-amber-800/60",
    error: "bg-gradient-to-br from-red-100/80 to-red-200/60 dark:from-red-900/80 dark:to-red-800/60",
  }

  return (
    <Card className={`shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] border backdrop-blur-sm ${variantStyles[variant]} ${className || ""} group cursor-pointer`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide uppercase">{title}</CardTitle>
        <div className={`p-3 rounded-2xl shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:scale-110 ${iconBgStyles[variant]}`}>
          <Icon className={`h-6 w-6 transition-all duration-300 ${iconStyles[variant]}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white group-hover:scale-105 transition-transform duration-300">
          {value}
        </div>
        {description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            {description}
          </p>
        )}
        {trend && (
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp className={`h-3 w-3 ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`} />
            <span className={`font-medium ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-slate-500">from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
