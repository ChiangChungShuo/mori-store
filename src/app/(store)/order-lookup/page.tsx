import {
  GuestLookup,
  guestLookupMissMessage,
  type GuestLookupState,
} from '@/features/orders/guest-lookup'
import { lookupGuestOrder } from '@/features/orders/queries'
import { isE2EMode } from '@/testing/e2e-mode'
import { submitGuestBankTransferLastFive } from '@/features/orders/bank-transfer-actions'

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
    <main className="section order-lookup-page">
      <header className="page-heading order-lookup-heading">
        <p>order lookup</p>
        <h1>免登入訂單查詢</h1>
        <span>輸入訂單編號與下單 Email 即可查詢；會員也可從會員中心查看完整紀錄。</span>
        {isE2EMode() ? <small className="order-lookup-demo">本機測試：MORI-DEMO-1001／parent@example.com。重新啟動開發伺服器後，新建立的示範訂單會重置。</small> : null}
      </header>
      <GuestLookup action={findOrder} bankTransferAction={submitGuestBankTransferLastFive} />
    </main>
  )
}
