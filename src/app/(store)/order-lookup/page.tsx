import {
  GuestLookup,
  guestLookupMissMessage,
  type GuestLookupState,
} from '@/features/orders/guest-lookup'
import { lookupGuestOrder } from '@/features/orders/queries'

export default function OrderLookupPage() {
  async function findOrder(
    _previousState: GuestLookupState | null,
    formData: FormData,
  ): Promise<GuestLookupState> {
    'use server'

    try {
      const order = await lookupGuestOrder(
        formData.get('orderNumber')?.toString() ?? '',
        formData.get('email')?.toString() ?? '',
      )
      return order
        ? { order, message: null }
        : { order: null, message: guestLookupMissMessage }
    } catch {
      return { order: null, message: guestLookupMissMessage }
    }
  }

  return (
    <main className="section">
      <header className="page-heading">
        <p>order lookup</p>
        <h1>訪客訂單查詢</h1>
      </header>
      <GuestLookup action={findOrder} />
    </main>
  )
}
