/** GET /coins/balance */
export interface CoinBalanceResponse {
  balanceMinor: number;
}

/** GET /coins/packages */
export interface CoinPackage {
  id: string;
  name: string;
  coinsMinor: number;
  stripePriceId: string | null;
  appleProductId: string | null;
  googleProductId: string | null;
  sortOrder: number;
}

/** POST /coins/checkout/stripe */
export interface CoinStripeCheckoutResponse {
  url: string;
  sessionId: string;
}
