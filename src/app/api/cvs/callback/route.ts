import { NextRequest, NextResponse } from 'next/server'
import { CVS_STORE_COOKIE, type PickedStore } from '@/lib/checkout/cvs-map'

// ECPay 門市電子地圖 posts the chosen store here after the shopper picks one on
// emap.pcsc.com.tw. We stash it in a short-lived cookie and send the shopper back
// to /checkout, where the store fields are prefilled from it.
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const subType = form.get('LogisticsSubType')?.toString() ?? ''
  const store: PickedStore = {
    chain: subType.startsWith('FAMI') ? 'family_mart' : 'seven_eleven',
    storeId: (form.get('CVSStoreID')?.toString() ?? '').slice(0, 20),
    storeName: (form.get('CVSStoreName')?.toString() ?? '').slice(0, 60),
    address: (form.get('CVSAddress')?.toString() ?? '').slice(0, 120),
  }

  const response = NextResponse.redirect(new URL('/checkout', request.url), 303)
  if (store.storeId && store.storeName) {
    response.cookies.set(CVS_STORE_COOKIE, JSON.stringify(store), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 600,
    })
  }
  return response
}
