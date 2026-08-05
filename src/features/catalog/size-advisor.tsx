'use client'

import { useState } from 'react'

/**
 * Height-based size suggestion.
 *
 * Kids' sizes are height-based (90 = ~90 cm) but parents rarely know the shop's
 * convention, and this shop does not accept returns — so a wrong guess is a
 * complaint, not an exchange. The advisor maps a height to the closest size the
 * product actually sells and hands it to the size picker.
 */

// Ranges follow the standard Taiwanese kids' size chart shown on the page.
const sizeRanges: Array<{ size: string; min: number; max: number }> = [
  { size: '70', min: 60, max: 74 },
  { size: '80', min: 75, max: 84 },
  { size: '90', min: 85, max: 94 },
  { size: '100', min: 95, max: 104 },
  { size: '110', min: 105, max: 114 },
  { size: '120', min: 115, max: 124 },
  { size: '130', min: 125, max: 134 },
  { size: '140', min: 135, max: 144 },
  { size: '150', min: 145, max: 155 },
]

export function suggestSize(height: number, availableSizes: string[]): { size: string; exact: boolean } | null {
  if (!Number.isFinite(height) || height < 45 || height > 180) return null
  const numeric = availableSizes
    .map((size) => ({ size, value: Number.parseInt(size, 10) }))
    .filter((entry) => Number.isFinite(entry.value))
  if (numeric.length === 0) return null

  const band = sizeRanges.find((range) => height >= range.min && height <= range.max)
  if (band && numeric.some((entry) => entry.size === band.size)) {
    return { size: band.size, exact: true }
  }

  // Round up to the next size the shop sells: children grow into clothes.
  const larger = numeric.filter((entry) => entry.value >= height).sort((a, b) => a.value - b.value)[0]
  const smaller = numeric.sort((a, b) => b.value - a.value)[0]
  const pick = larger ?? smaller
  return pick ? { size: pick.size, exact: false } : null
}

export function SizeAdvisor({ availableSizes, onPick }: {
  availableSizes: string[]
  onPick: (size: string) => void
}) {
  const [height, setHeight] = useState('')
  const suggestion = suggestSize(Number.parseInt(height, 10), availableSizes)

  // Free-size items (F, one-size accessories) have nothing to advise on, and
  // asking for a height there only produces a misleading "no size fits".
  const hasNumericSizes = availableSizes.some((size) => Number.isFinite(Number.parseInt(size, 10)))
  if (availableSizes.length === 0 || !hasNumericSizes) return null

  return (
    <div className="size-advisor">
      <label>
        不確定尺寸？輸入孩子身高
        <span>
          <input
            inputMode="numeric"
            max={180}
            min={45}
            onChange={(event) => setHeight(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            placeholder="例：104"
            value={height}
          />
          <em>cm</em>
        </span>
      </label>
      {height.length >= 2 ? (
        suggestion ? (
          <p aria-live="polite" className="size-advisor-result">
            建議<strong>尺寸 {suggestion.size}</strong>
            {suggestion.exact ? '' : '（這件最接近的尺寸）'}
            <button onClick={() => onPick(suggestion.size)} type="button">直接選這個尺寸</button>
          </p>
        ) : (
          <p aria-live="polite" className="size-advisor-result">
            這件沒有適合這個身高的尺寸，可以看看其他款式。
          </p>
        )
      ) : (
        <small>孩子長得快，建議寬鬆一點可以穿久一些；下方尺寸表有實際平量數字。</small>
      )}
    </div>
  )
}
