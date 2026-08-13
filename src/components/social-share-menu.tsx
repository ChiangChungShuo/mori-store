'use client'

import { useState } from 'react'

const channels = [
  { key: 'line', label: 'LINE' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'twitter', label: 'X / Twitter' },
] as const

export function ProductShareButtons({ productName }: { productName: string }) {
  const [copied, setCopied] = useState(false)

  function share(channel: (typeof channels)[number]['key']) {
    const url = encodeURIComponent(window.location.href)
    const text = encodeURIComponent(`${productName}｜MORIMUR BABY`)
    const shareUrl = channel === 'line'
      ? `https://social-plugins.line.me/lineit/share?url=${url}`
      : channel === 'facebook'
        ? `https://www.facebook.com/sharer/sharer.php?u=${url}`
        : `https://twitter.com/intent/tweet?url=${url}&text=${text}`

    window.open(shareUrl, 'mori-share', 'popup,width=680,height=620,noopener,noreferrer')
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="product-share" aria-label="分享商品">
      <span>分享這件商品</span>
      <div>
        {channels.map((channel) => (
          <button aria-label={`分享到 ${channel.label}`} data-channel={channel.key} key={channel.key} onClick={() => share(channel.key)} type="button">
            <span aria-hidden="true">{channel.key === 'line' ? 'L' : channel.key === 'facebook' ? 'f' : 'X'}</span>
          </button>
        ))}
        <button aria-label="複製商品連結" data-channel="copy" onClick={copyLink} type="button"><span aria-hidden="true">↗</span></button>
      </div>
      <small aria-live="polite">{copied ? '商品連結已複製' : '把喜歡的款式分享給家人朋友'}</small>
    </div>
  )
}
