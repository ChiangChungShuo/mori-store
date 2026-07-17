const taipeiDateTimeFormatter = new Intl.DateTimeFormat('zh-TW', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'Asia/Taipei',
})

export function formatTaipeiDateTime(value: string) {
  return taipeiDateTimeFormatter.format(new Date(value))
}
