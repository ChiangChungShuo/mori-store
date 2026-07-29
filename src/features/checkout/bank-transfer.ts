export type BankTransferInfo = {
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
  isConfigured: boolean
}

export function getBankTransferInfo(): BankTransferInfo {
  const bankName = process.env.MORI_BANK_NAME?.trim() ?? ''
  const bankCode = process.env.MORI_BANK_CODE?.trim() ?? ''
  const accountNumber = process.env.MORI_BANK_ACCOUNT?.trim() ?? ''
  const accountName = process.env.MORI_BANK_ACCOUNT_NAME?.trim() ?? ''
  return {
    bankName: bankName || '示範銀行',
    bankCode: bankCode || '000',
    accountNumber: accountNumber || '請於正式上線前設定收款帳號',
    accountName: accountName || 'mori 示範商店',
    isConfigured: Boolean(bankName && bankCode && accountNumber && accountName),
  }
}
