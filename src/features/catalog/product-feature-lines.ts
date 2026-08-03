const LEADING_MARKER = /^(?:[✿❀✾✽❁☘︎☘🌸•●▪︎]|\d+[.)、]|[-–—])\s*/u

export function productFeatureLines(description: string) {
  return description
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(LEADING_MARKER, '').trim())
    .filter(Boolean)
}
