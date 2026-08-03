'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { useActionToast } from '@/components/toast'
import type { CustomerPhoto, CustomerPhotoState } from '@/features/storefront/customer-photos'

type PhotoAction = (state: CustomerPhotoState, formData: FormData) => Promise<CustomerPhotoState>

export function CustomerPhotoManager({
  photos,
  products,
  addPhoto,
  deletePhoto,
}: {
  photos: CustomerPhoto[]
  products: Array<{ id: string; name: string }>
  addPhoto: PhotoAction
  deletePhoto: PhotoAction
}) {
  const [addState, addAction, addPending] = useActionState(addPhoto, { ok: false, message: '' })
  const [deleteState, deleteAction, deletePending] = useActionState(deletePhoto, { ok: false, message: '' })
  useActionToast(addState)
  useActionToast(deleteState)
  const productNames = new Map(products.map((product) => [product.id, product.name]))

  return (
    <section className="admin-panel customer-photo-panel">
      <header>
        <div><p className="eyebrow">social proof</p><h2>大家怎麼穿</h2></div>
        <p>把顧客分享的穿搭照（取得同意後）掛到對應商品頁，是最有力的口碑。</p>
      </header>

      {photos.length === 0 ? <p className="admin-panel-note">尚未新增顧客照片。從 IG 或 LINE 收到的曬單，經同意後上傳到這裡就會顯示在商品頁。</p> : (
        <div className="customer-photo-grid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              <Image alt={photo.caption || '顧客穿搭照片'} height={150} src={photo.imageUrl} unoptimized={photo.imageUrl.startsWith('data:')} width={120} />
              <figcaption>
                <strong>{photo.productId ? productNames.get(photo.productId) ?? '（商品已刪除）' : '未指定商品'}</strong>
                {photo.caption ? <small>{photo.caption}</small> : null}
              </figcaption>
              <form action={deleteAction} data-confirm="danger">
                <input name="id" type="hidden" value={photo.id} />
                <button aria-label={`刪除照片 ${photo.caption || photo.id}`} disabled={deletePending} type="submit">刪除</button>
              </form>
            </figure>
          ))}
        </div>
      )}

      <form action={addAction} className="admin-stack-form customer-photo-form">
        <div className="form-split">
          <label>照片<input accept="image/jpeg,image/png,image/webp" name="file" required type="file" /></label>
          <label>顯示在哪個商品
            <select defaultValue="" name="productId" required>
              <option disabled value="">選擇商品</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
        </div>
        <label>說明（選填）<input maxLength={120} name="caption" placeholder="例：小樹 T 恤 100cm・IG @mama.chen 分享" /></label>
        <button className="button" disabled={addPending} type="submit">{addPending ? '上傳中…' : '新增顧客照片'}</button>
        <small className="admin-field-hint">請務必先取得顧客同意再使用照片；建議直式構圖，檔案 5 MB 以內。</small>
      </form>
    </section>
  )
}
