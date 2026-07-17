import Link from 'next/link'
import {
  getStoreSettings,
  updateStoreSettingsFromForm,
} from '@/features/admin/settings-actions'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const settings = await getStoreSettings()

  return (
    <main className="section">
      <p><Link href="/admin">← 返回後台</Link></p>
      <header className="page-heading">
        <p>admin / settings</p>
        <h1>商店設定</h1>
      </header>
      <form action={updateStoreSettingsFromForm} className="checkout-form">
        <label>
          運費
          <input defaultValue={settings.shippingFee} min="0" name="shippingFee" required step="1" type="number" />
        </label>
        <label>
          免運門檻
          <input
            defaultValue={settings.freeShippingThreshold ?? ''}
            min="0"
            name="freeShippingThreshold"
            placeholder="留白代表不提供免運"
            step="1"
            type="number"
          />
        </label>
        <label>
          聯絡 Email
          <input defaultValue={settings.contactEmail} name="contactEmail" required type="email" />
        </label>
        <button className="button" type="submit">儲存設定</button>
      </form>
    </main>
  )
}
