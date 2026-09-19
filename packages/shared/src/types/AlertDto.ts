export interface AlertDto {
  id: string
  symbol: string
  thresholdPct: number
  isGlobal: boolean // true if this is the user's default %; false if per-ticker override
  lastFiredAt: string | null
}
