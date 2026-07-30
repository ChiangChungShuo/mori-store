// A product is marked pre-order by carrying this tag. Pre-order products are
// sellable without real stock (the admin form sets a high stock so checkout
// allows purchase) and show a lead-time note on the storefront.
export const PREORDER_TAG = '預購'

export const PREORDER_NOTE = '預購商品・約 14–21 個工作天出貨'

// Stock assigned to pre-order variants so they remain purchasable.
export const PREORDER_STOCK = 999

export function isPreorder(tags?: readonly string[] | null): boolean {
  return Boolean(tags?.includes(PREORDER_TAG))
}
