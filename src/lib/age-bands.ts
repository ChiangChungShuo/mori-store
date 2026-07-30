import type { AgeBand } from '@/types/store'

// The three storefront age groups. `value` is what is stored on products and
// used in filters; `label`/`range` are for display.
export const AGE_BANDS: ReadonlyArray<{ value: AgeBand; label: string; range: string }> = [
  { value: '0-3', label: 'Baby', range: '0–3 歲' },
  { value: '3-6', label: 'Kids', range: '3–6 歲' },
  { value: '6-12', label: 'Junior', range: '6–12 歲' },
]

export const AGE_BAND_VALUES: AgeBand[] = AGE_BANDS.map((band) => band.value)

export function ageBandLabel(value: string): string {
  return AGE_BANDS.find((band) => band.value === value)?.label ?? value
}

export function ageBandRange(value: string): string {
  return AGE_BANDS.find((band) => band.value === value)?.range ?? `${value} 歲`
}
