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

export function findTestStore(chain: TestStore['chain'], storeId: string) {
  return TEST_STORES.find((store) => store.chain === chain && store.storeId === storeId)
}
