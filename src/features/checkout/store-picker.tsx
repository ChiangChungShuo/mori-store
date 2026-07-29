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
    Device: chain === 'family_mart'
      ? '0'
      : /Mobi|Android|iPhone/i.test(navigator.userAgent) ? '1' : '0',
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
  const localStore = chain === 'seven_eleven'
    ? { name: '7-ELEVEN 測試門市', id: '000001' }
    : { name: '全家測試門市', id: 'F00001' }

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
          <label data-selected={chain === 'family_mart'}>
            <input
              aria-label="全家"
              aria-describedby={errors.chain ? 'checkout-chain-error' : undefined}
              checked={chain === 'family_mart'}
              name="chain"
              onChange={() => onChainChange('family_mart')}
              required
              type="radio"
              value="family_mart"
            />
            <span><strong>全家</strong><small>FamilyMart 取貨</small></span>
          </label>
        </div>
      </fieldset>
      {errors.chain ? <span id="checkout-chain-error" role="alert">{errors.chain}</span> : null}
      <div className="store-map-picker">
        <button type="button" className="button button-secondary store-map-button" onClick={handleOpenStorePicker}>
          {storeName ? '重新選擇門市' : `開啟${chain === 'seven_eleven' ? '7-ELEVEN' : '全家'}門市地圖`}
        </button>
        {storeName && storeId ? (
          <p className="store-map-selected" aria-live="polite">
            <strong>已選門市：{storeName}</strong>
            <span>店號 {storeId}{storeAddress ? `・${storeAddress}` : ''}</span>
          </p>
        ) : (
          <p className="store-map-note">用地圖選店會自動帶回門市名稱與店號；或於下方手動填寫。</p>
        )}
      </div>
      <label>
        取貨門市名稱
        <input
          aria-describedby={errors.storeName ? 'checkout-store-name-error' : undefined}
          aria-invalid={Boolean(errors.storeName)}
          name="storeName"
          required
          maxLength={60}
          value={storeName}
          placeholder="例：忠孝門市"
          onChange={(event) => onStoreNameChange(event.target.value)}
        />
      </label>
      {errors.storeName ? <span id="checkout-store-name-error" role="alert">{errors.storeName}</span> : null}
      <label>
        門市店號
        <input
          aria-describedby={errors.storeId ? 'checkout-store-error' : undefined}
          aria-invalid={Boolean(errors.storeId)}
          name="storeId"
          required
          maxLength={20}
          value={storeId}
          placeholder={chain === 'seven_eleven' ? '例：123456' : '例：012345'}
          onChange={(event) => onStoreIdChange(event.target.value)}
        />
      </label>
      {errors.storeId ? <span id="checkout-store-error" role="alert">{errors.storeId}</span> : null}
      <p className="store-picker-hint">
        請填寫你方便取貨的 {chain === 'seven_eleven' ? '7-ELEVEN' : '全家'} 門市名稱與店號（可在超商 App 或門市櫃台查詢），我們會依此為你寄件。
      </p>
      {localPickerOpen ? (
        <div className="local-store-dialog-backdrop">
          <section aria-labelledby="local-store-dialog-title" aria-modal="true" className="local-store-dialog" role="dialog">
            <header>
              <div><small>local preview</small><h2 id="local-store-dialog-title">選擇{chain === 'seven_eleven' ? '7-ELEVEN' : '全家'}測試門市</h2></div>
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
