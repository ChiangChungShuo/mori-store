'use client'

import { useState } from 'react'
import { ecpayMap, cvsSubType, type StoreChain } from '@/lib/checkout/cvs-map'

export type { StoreChain }

type StorePickerProps = {
  chain: StoreChain
  storeName: string
  storeId: string
  storeAddress?: string
  errors?: Partial<Record<'chain' | 'storeName' | 'storeId', string>>
  onChainChange: (chain: StoreChain) => void
  onStoreNameChange: (value: string) => void
  onStoreIdChange: (value: string) => void
}

function openStoreMap(chain: StoreChain) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = ecpayMap.url
  const fields: Record<string, string> = {
    MerchantID: ecpayMap.merchantId,
    MerchantTradeNo: `MORI${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    LogisticsType: 'CVS',
    LogisticsSubType: cvsSubType(chain),
    IsCollection: 'N',
    ServerReplyURL: `${window.location.origin}/api/cvs/callback`,
    Device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? '1' : '0',
  }
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}

function usesLocalNetworkPicker() {
  return window.location.protocol === 'http:'
    && window.location.hostname !== 'localhost'
    && window.location.hostname !== '127.0.0.1'
}

export function StorePicker({
  chain,
  storeName,
  storeId,
  storeAddress,
  errors = {},
  onChainChange,
  onStoreNameChange,
  onStoreIdChange,
}: StorePickerProps) {
  const [localPickerOpen, setLocalPickerOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const localStore = { name: '7-ELEVEN 測試門市', id: '000001' }
  const picked = Boolean(storeName.trim() && storeId.trim())

  function handleOpenStorePicker() {
    if (usesLocalNetworkPicker()) {
      setLocalPickerOpen(true)
      return
    }
    openStoreMap(chain)
  }

  function chooseLocalStore() {
    onStoreNameChange(localStore.name)
    onStoreIdChange(localStore.id)
    setLocalPickerOpen(false)
  }

  return (
    <fieldset className="store-picker">
      <legend>取貨門市</legend>
      <fieldset className="store-chain-options">
        <legend>超商通路</legend>
        <div>
          <label data-selected={chain === 'seven_eleven'}>
            <input
              aria-label="7-ELEVEN"
              aria-describedby={errors.chain ? 'checkout-chain-error' : undefined}
              checked={chain === 'seven_eleven'}
              name="chain"
              onChange={() => onChainChange('seven_eleven')}
              required
              type="radio"
              value="seven_eleven"
            />
            <span><strong>7-ELEVEN</strong><small>統一超商取貨</small></span>
          </label>
        </div>
      </fieldset>
      {errors.chain ? <span id="checkout-chain-error" role="alert">{errors.chain}</span> : null}

      {picked ? (
        // Chosen on the 7-ELEVEN map: show what came back instead of asking the
        // shopper to copy the name and store number by hand.
        <div className="store-chosen" aria-live="polite">
          <div>
            <p className="store-chosen-label">已選取貨門市</p>
            <strong>{storeName}</strong>
            <span>店號 {storeId}{storeAddress ? `・${storeAddress}` : ''}</span>
          </div>
          <button className="store-chosen-change" onClick={handleOpenStorePicker} type="button">重新選擇</button>
          <input name="storeName" type="hidden" value={storeName} />
          <input name="storeId" type="hidden" value={storeId} />
        </div>
      ) : (
        <div className="store-map-picker">
          <button type="button" className="button store-map-button" onClick={handleOpenStorePicker}>
            開啟 7-ELEVEN 門市地圖
          </button>
          <p className="store-map-note">在地圖上選好門市，名稱與店號會自動帶回來，不用自己輸入。</p>
        </div>
      )}

      {/* Fallback for the rare case the map cannot open (pop-up blockers, an
          in-app browser); hidden behind a summary so it is not a second form
          everyone feels obliged to fill in. */}
      <details className="store-manual" open={manualOpen || Boolean(errors.storeName || errors.storeId)} onToggle={(event) => setManualOpen(event.currentTarget.open)}>
        <summary>地圖打不開？手動填寫門市</summary>
        <label>
          取貨門市名稱
          <input
            aria-describedby={errors.storeName ? 'checkout-store-name-error' : undefined}
            aria-invalid={Boolean(errors.storeName)}
            maxLength={60}
            name={picked ? undefined : 'storeName'}
            onChange={(event) => onStoreNameChange(event.target.value)}
            placeholder="例：忠孝門市"
            value={storeName}
          />
        </label>
        {errors.storeName ? <span id="checkout-store-name-error" role="alert">{errors.storeName}</span> : null}
        <label>
          門市店號
          <input
            aria-describedby={errors.storeId ? 'checkout-store-error' : undefined}
            aria-invalid={Boolean(errors.storeId)}
            maxLength={20}
            name={picked ? undefined : 'storeId'}
            onChange={(event) => onStoreIdChange(event.target.value)}
            placeholder="例：123456"
            value={storeId}
          />
        </label>
        {errors.storeId ? <span id="checkout-store-error" role="alert">{errors.storeId}</span> : null}
        <small>門市名稱與店號可在 7-ELEVEN App 或門市櫃台查詢。</small>
      </details>
      {localPickerOpen ? (
        <div className="local-store-dialog-backdrop">
          <section aria-labelledby="local-store-dialog-title" aria-modal="true" className="local-store-dialog" role="dialog">
            <header>
              <div><small>local preview</small><h2 id="local-store-dialog-title">選擇 7-ELEVEN 測試門市</h2></div>
              <button aria-label="關閉測試門市選擇" onClick={() => setLocalPickerOpen(false)} type="button">×</button>
            </header>
            <p>目前使用區網 HTTP 預覽，為避免瀏覽器攔截資料回傳，請先使用測試門市完成結帳流程。</p>
            <button aria-label={`選擇${localStore.name}`} className="local-store-option" onClick={chooseLocalStore} type="button">
              <strong>選擇{localStore.name}</strong>
              <span>店號 {localStore.id}・本機流程測試專用</span>
            </button>
            <small>正式 HTTPS 上線並設定綠界商店後，會改用真實超商門市地圖。</small>
          </section>
        </div>
      ) : null}
    </fieldset>
  )
}
