import { Order, OrderBook, STOCK_BALANCES } from "../trade/Orderbook"

export type MessageToApi = {
    type: "BALANCE_UPDATED",
    payload: {
        updatedBalance: number
    }
} | {
    type: "OPEN_ORDERS",
    payload: {
        openOrders: OrderBook[string]
    };
} | {
    type: "ORDER_PLACED",
    payload: {
        executedQty: number
    }
} | {
    type: "ORDER_CANCELLED",
    payload: {
        executedQty: number
    }
} | {
    type: "CURRENT_BALANCE",
    payload: {
        currentBalance: number
    }
} | {
    type: "STOCK_BALANCE",
    payload: {
        stockbalance: STOCK_BALANCES
    }
}

