'use client'

import type { TestStore } from '@/features/checkout/types'
import { TEST_STORES } from '@/features/checkout/stores'

export { TEST_STORES }

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
      {selectedStore ? <p>{selectedStore.address}</p> : null}
    </fieldset>
  )
}
