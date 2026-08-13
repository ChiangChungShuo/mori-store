const SERIES_NAMES: Array<[RegExp, string]> = [
  [/Mori\s+(?:Lento|Lemto)(?:\s*慢日系列)?/gi, 'Mori Lento'],
  [/Mori\s+Flora(?:\s*漫花系列)?/gi, 'Mori Flora'],
  [/Mori\s+Olive(?:\s*森語系列)?/gi, 'Mori Olive'],
  [/Mori\s+Blanche(?:\s*(?:純境|白境)系列)?/gi, 'Mori Blanche'],
  [/Mori\s+Lumi(?:\s*(?:拾光|微光)系列)?/gi, 'Mori Lumi'],
  [/Mori\s+Campus(?:\s*學院系列)?/gi, 'Mori Campus'],
]

const SERIES_LABELS: Array<[RegExp, string]> = [
  [/Mori\s+(?:Lento|Lemto)(?:\s*[|｜]?\s*慢日系列)?/gi, 'Mori Lento｜慢日系列'],
  [/Mori\s+Flora(?:\s*[|｜]?\s*漫花系列)?/gi, 'Mori Flora｜漫花系列'],
  [/Mori\s+Olive(?:\s*[|｜]?\s*森語系列)?/gi, 'Mori Olive｜森語系列'],
  [/Mori\s+Blanche(?:\s*[|｜]?\s*(?:純境|白境)系列)?/gi, 'Mori Blanche｜純境系列'],
  [/Mori\s+Lumi(?:\s*[|｜]?\s*(?:拾光|微光)系列)?/gi, 'Mori Lumi｜拾光系列'],
  [/Mori\s+Campus(?:\s*[|｜]?\s*學院系列)?/gi, 'Mori Campus｜學院系列'],
]

export function normalizeSeriesName(name: string) {
  let normalized = name.trim()
  for (const [pattern, replacement] of SERIES_LABELS) {
    normalized = normalized.replace(pattern, replacement)
  }
  return normalized.replace(/\s*[|｜]\s*/g, '｜').replace(/\s+/g, ' ')
}

export function normalizeProductName(name: string) {
  let normalized = name.trim()
  for (const [pattern, replacement] of SERIES_NAMES) {
    normalized = normalized.replace(pattern, replacement)
  }
  return normalized
    .replace(/\s*[|｜]\s*/g, '｜')
    .replace(/\s*[（(]\s*(\d+)\s*色\s*[）)]/g, '（$1色）')
    .replace(/\s+/g, ' ')
}

const COLOR_FAMILIES: Array<[string, RegExp]> = [
  ['白', /白|象牙|奶油|cream|ivory/i],
  ['黑', /黑|墨/i],
  ['灰', /灰|銀/i],
  ['藍', /藍|海軍|navy|denim/i],
  ['綠', /綠|橄欖|薄荷|鼠尾草|苔蘚/i],
  ['粉', /粉|玫瑰|藕/i],
  ['紅', /紅|酒紅/i],
  ['黃', /黃|芥末/i],
  ['橘', /橘|橙/i],
  ['紫', /紫|薰衣草/i],
  ['咖', /咖|棕|茶|卡其|駝|燕麥|杏|米/i],
]

export function colorFamily(color: string) {
  const value = color.trim()
  return COLOR_FAMILIES.find(([, pattern]) => pattern.test(value))?.[0] ?? '花色／圖案'
}

export function listColorFamilies(colors: Iterable<string>) {
  const order = [...COLOR_FAMILIES.map(([family]) => family), '花色／圖案']
  const families = new Set([...colors].map(colorFamily))
  return order.filter((family) => families.has(family))
}

// Splits a catalog name like "Mori Olive｜華夫格條紋套裝（2色）" into the series
// eyebrow and the plain title shown on cards. The colour count chip is dropped
// because the card already states the number of colours.
export function splitProductDisplayName(name: string) {
  const normalized = normalizeProductName(name)
  const withoutCount = normalized.replace(/（\d+色）\s*$/, '').trim()
  const separatorIndex = withoutCount.indexOf('｜')
  if (separatorIndex > 0 && /^mori\s/i.test(withoutCount)) {
    return {
      series: withoutCount.slice(0, separatorIndex).trim(),
      title: withoutCount.slice(separatorIndex + 1).trim() || withoutCount,
    }
  }
  return { series: null, title: withoutCount }
}
