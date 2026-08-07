/**
 * Type declarations untuk paket midtrans-client yang tidak punya @types.
 * Hanya mencakup yang dipakai di kode ini: Snap.createTransaction.
 */
declare module "midtrans-client" {
  interface SnapConfig {
    isProduction: boolean
    serverKey: string
    clientKey?: string
  }

  interface TransactionDetails {
    order_id: string
    gross_amount: number
  }

  interface ItemDetail {
    id: string
    price: number
    quantity: number
    name: string
  }

  interface CreateTransactionParam {
    transaction_details: TransactionDetails
    item_details?: ItemDetail[]
    customer_details?: Record<string, unknown>
    [key: string]: unknown
  }

  interface CreateTransactionResult {
    token: string
    redirect_url: string
  }

  class Snap {
    constructor(config: SnapConfig)
    createTransaction(
      param: CreateTransactionParam
    ): Promise<CreateTransactionResult>
  }

  const MidtransClient: {
    Snap: typeof Snap
  }

  export = MidtransClient
}
