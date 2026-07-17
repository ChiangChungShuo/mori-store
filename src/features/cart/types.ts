export type CartItem = {
  variantId: string
  productSlug: string
  name: string
  imageUrl: string | null
  color: string
  size: string
  unitPrice: number
  quantity: number
  maxStock: number
}
