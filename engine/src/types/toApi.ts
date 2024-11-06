import { Order } from "../trade/Orderbook"

export type MessageToApi = {
    type: "DEPTH",
    payload: {
        yes: [string, string][],
        no: [string, string][]
    }
} | {
    type: "BALANCE_UPDATED",
    payload: {
        updatedBalance: number
    }
} | {
    type: "OPEN_ORDERS",
    payload: Order[];
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
};

