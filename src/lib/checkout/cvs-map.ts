// 綠界 ECPay 門市電子地圖 (CVS store map) — opens the official 7-ELEVEN / 全家 store
// selector (emap.pcsc.com.tw) and posts the chosen store back to our ServerReplyURL.
// Defaults target ECPay's public STAGING map with the shared test MerchantID so the
// button works before you have a production account. Override via env for production.
export const ecpayMap = {
  url: process.env.NEXT_PUBLIC_ECPAY_MAP_URL ?? 'https://logistics-stage.ecpay.com.tw/Express/map',
  // C2C (超商店到店/交貨便) staging test merchant. NOTE: 2000132 is the B2C test id and does
  // NOT have C2C enabled, which triggers "找不到加密金鑰"; 2000933 is the C2C test merchant.
  merchantId: process.env.NEXT_PUBLIC_ECPAY_MERCHANT_ID ?? '2000933',
}

export type StoreChain = 'seven_eleven' | 'family_mart'

export function cvsSubType(chain: StoreChain) {
  return chain === 'seven_eleven' ? 'UNIMARTC2C' : 'FAMIC2C'
}

export type PickedStore = {
  chain: StoreChain
  storeId: string
  storeName: string
  address: string
}

export const CVS_STORE_COOKIE = 'mori-cvs-store'
