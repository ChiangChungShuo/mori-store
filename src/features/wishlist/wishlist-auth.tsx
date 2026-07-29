'use client'

import { createContext, useContext } from 'react'

const WishlistAuthContext = createContext(false)

export function WishlistAuthProvider({ isSignedIn, children }: { isSignedIn: boolean; children: React.ReactNode }) {
  return <WishlistAuthContext.Provider value={isSignedIn}>{children}</WishlistAuthContext.Provider>
}

export function useWishlistAuth() {
  return useContext(WishlistAuthContext)
}
