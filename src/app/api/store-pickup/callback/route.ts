import { NextRequest, NextResponse } from 'next/server'
import { CVS_STORE_COOKIE, type PickedStore } from '@/lib/checkout/cvs-map'

// ECPay 門市電子地圖 sends the chosen store here after the shopper picks one on
// emap.pcsc.com.tw. We stash it in a short-lived cookie and send the shopper back
// to /checkout, where the store fields are prefilled from it.
//
// The folder is deliberately not called `cvs`: upload tooling treats a directory
// of that name as legacy CVS metadata and drops it, so the route 404'd in
// production while working locally.
function storeFrom(values: FormData | URLSearchParams) {
  const read = (name: string) => values.get(name)?.toString() ?? ''
  return {
    subType: read('LogisticsSubType'),
    store: {
      chain: 'seven_eleven',
      storeId: read('CVSStoreID').slice(0, 20),
      storeName: read('CVSStoreName').slice(0, 60),
      address: read('CVSAddress').slice(0, 120),
    } satisfies PickedStore,
  }
}

function replyWith(request: NextRequest, subType: string, store: PickedStore) {
  const response = NextResponse.redirect(new URL('/checkout', request.url), 303)
  if (subType.startsWith('UNIMART') && store.storeId && store.storeName) {
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

export async function POST(request: NextRequest) {
  const { subType, store } = storeFrom(await request.formData())
  return replyWith(request, subType, store)
}

// Some map flows come back as a plain GET with the store in the query string;
// a 405 there would strand the shopper on a blank page mid-checkout.
export async function GET(request: NextRequest) {
  const { subType, store } = storeFrom(request.nextUrl.searchParams)
  return replyWith(request, subType, store)
}
