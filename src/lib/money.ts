const twd = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0,
})

export function formatTwd(value: number) {
  return twd.format(value).replace('$', 'NT$')
}
