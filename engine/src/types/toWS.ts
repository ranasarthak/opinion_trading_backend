import { OrderBook } from "../trade/Orderbook"

export type MessageToWs = {
   payload: {
    market: OrderBook[string]
   }
}