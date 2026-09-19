export interface ChannelDto {
  id: string
  key: "tech" | "finance" | "crypto" | "ai-papers" | "design" | "gaming"
  label: string
  defaultOn: boolean
  sources: string[] // source IDs; admin manages
}
