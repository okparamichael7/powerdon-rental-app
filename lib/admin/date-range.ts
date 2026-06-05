export function daysFromRange(range: string): number {
  switch (range) {
    case '24h':
      return 1
    case '7d':
      return 7
    case '30d':
      return 30
    case '90d':
      return 90
    default:
      return 7
  }
}
