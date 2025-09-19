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
}

export function StatsCard({ title, value, description, icon: Icon, variant = "default", trend }: StatsCardProps) {
  const variantStyles = {
    default: "bg-gradient-to-br from-card via-card/95 to-card/90 border-border/30 hover:border-border/50",
    success: "bg-gradient-to-br from-primary/5 via-primary/8 to-primary/12 border-primary/20 hover:border-primary/30",
    warning: "bg-gradient-to-br from-chart-2/5 via-chart-2/8 to-chart-2/12 border-chart-2/20 hover:border-chart-2/30",
    error:
      "bg-gradient-to-br from-destructive/5 via-destructive/8 to-destructive/12 border-destructive/20 hover:border-destructive/30",
  }

  const iconStyles = {
    default: "text-muted-foreground",
    success: "text-primary",
    warning: "text-chart-2",
    error: "text-destructive",
  }

  const iconBgStyles = {
    default: "bg-gradient-to-br from-background/80 to-muted/30",
    success: "bg-gradient-to-br from-primary/10 to-primary/20",
    warning: "bg-gradient-to-br from-chart-2/10 to-chart-2/20",
    error: "bg-gradient-to-br from-destructive/10 to-destructive/20",
  }

  return (
    <Card
      className={`shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] border backdrop-blur-sm ${variantStyles[variant]} group cursor-pointer`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">{title}</CardTitle>
        <div
          className={`p-3 rounded-xl shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:scale-110 ${iconBgStyles[variant]}`}
        >
          <Icon className={`h-5 w-5 transition-all duration-300 ${iconStyles[variant]}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-heading font-bold text-foreground tracking-tight transition-all duration-300 group-hover:scale-105">
          {value}
        </div>
        {description && <p className="text-sm text-muted-foreground font-medium leading-relaxed">{description}</p>}
        {trend && (
          <div
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-300 ${
              trend.isPositive
                ? "text-primary bg-primary/10 border border-primary/20"
                : "text-destructive bg-destructive/10 border border-destructive/20"
            }`}
          >
            {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>
              {trend.isPositive ? "+" : ""}
              {trend.value}% from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
