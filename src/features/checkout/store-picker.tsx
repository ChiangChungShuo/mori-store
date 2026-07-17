'use client'

import type { TestStore } from '@/features/checkout/types'

export const TEST_STORES: readonly TestStore[] = [
  {
    chain: 'seven_eleven',
    storeId: '123456',
    storeName: '台北門市',
    address: '台北市中正區忠孝西路一段 1 號',
  },
  {
    chain: 'seven_eleven',
    storeId: '234567',
    storeName: '森活門市',
    address: '台北市大安區和平東路二段 10 號',
  },
  {
    chain: 'family_mart',
    storeId: 'F00123',
    storeName: '台北車站店',
    address: '台北市中正區北平西路 3 號',
  },
  {
    chain: 'family_mart',
    storeId: 'F00456',
    storeName: '大安森林店',
    address: '台北市大安區新生南路二段 1 號',
  },
]

type StorePickerProps = {
  chain: TestStore['chain']
  storeId: string
  onChainChange: (chain: TestStore['chain']) => void
  onStoreChange: (store: TestStore) => void
}

export function StorePicker({
  chain,
  storeId,
  onChainChange,
  onStoreChange,
}: StorePickerProps) {
  const stores = TEST_STORES.filter((store) => store.chain === chain)
  const selectedStore = stores.find((store) => store.storeId === storeId)

  return (
    <fieldset className="store-picker">
      <legend>取貨門市</legend>
      <label>
        超商通路
        <select
          name="chain"
          required
          value={chain}
          onChange={(event) => onChainChange(event.target.value as TestStore['chain'])}
        >
          <option value="seven_eleven">7-ELEVEN</option>
          <option value="family_mart">全家</option>
        </select>
      </label>
      <label>
        取貨門市
        <select
          name="storeId"
          required
          value={storeId}
          onChange={(event) => {
            const store = stores.find((candidate) => candidate.storeId === event.target.value)
            if (store) onStoreChange(store)
          }}
        >
          <option value="">請選擇門市</option>
          {stores.map((store) => (
            <option key={store.storeId} value={store.storeId}>
              {store.storeName}（{store.storeId}）
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="storeName" value={selectedStore?.storeName ?? ''} />
      {selectedStore ? <p>{selectedStore.address}</p> : null}
    </fieldset>
  )
}
