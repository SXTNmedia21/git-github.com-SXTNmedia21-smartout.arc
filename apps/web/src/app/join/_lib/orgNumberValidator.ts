export function validateOrgNumber(value: string): boolean {
  const cleaned = value.replace(/\s/g, '')
  if (!/^\d{9}$/.test(cleaned)) return false
  const digits = cleaned.split('').map(Number)
  const weights = [3, 2, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, weight, i) => acc + weight * digits[i], 0)
  const remainder = sum % 11
  if (remainder === 1) return false
  const checkDigit = remainder === 0 ? 0 : 11 - remainder
  return checkDigit === digits[8]
}
