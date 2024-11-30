export const CREATE_ORDER = "Create_Order";
export const CANCEL_ORDER = "Cancel_Order";
export const ON_RAMP = "On_Ramp";
export const GET_OPEN_ORDERS = "Get_Open_Orders";
export const GET_INR_BALANCE = "Get_Inr_Balance";
export const OPEN_ORDERS = "Open_Orders";
export const GET_STOCK_BALANCE = "Get_Stock_Balance";


export interface IndividualOrders {
    quantity: number;
    listingType: 'original' | 'reverted';
}

export interface Order {
    total: number;
    orders: { [userId: string]: IndividualOrders };
}

export interface OrderBook {
    [symbol: string] : {
        'yes': Map<number, Order>;
        'no': Map<number, Order>;
    };
}

export interface OPEN_ORDERS {
    type: "Open_Orders",
    payload: {
        orderbook: OrderBook
    }
}

export type OrderPlaced = {
    type: "ORDER_PLACED",
    payload: {
        orderId: string,
        executedQty: number,
        fills:[
            {
                price: string,
                qty: number,
                tradeId: number
            }
        ]
    }
}

export type BalanceUpdated = {
    type: "BALANCE_UPDATED",
    payload: {
        updatedBalance: number
    }
    
}

export type MessageFromOrderbook = OPEN_ORDERS | OrderPlaced | BalanceUpdated;


export type MessageToEngine = {
    type: typeof CREATE_ORDER,
    data: {
        market: string,
        userId: string,
        stockType: 'yes' | 'no',
        side: 'buy' | 'sell',
        quantity: number,
        price: number
    }
} | {
    type: typeof CANCEL_ORDER,
    data: {
        market: string,
        userId: string
    }
} | {
    type: typeof GET_OPEN_ORDERS,
    data: {
        market: string
    }
} | {
    type: typeof GET_INR_BALANCE,
    data:{
        userId: string
    }
} | {
    type: typeof ON_RAMP,
    data: {
        userId: string,
        amount: number
    }
} | {
    type: typeof GET_STOCK_BALANCE,
    data: {
        userId: string
    }
}
