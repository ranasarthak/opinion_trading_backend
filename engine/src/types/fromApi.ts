export const CREATE_ORDER = "Create_Order";
export const CANCEL_ORDER = "Cancel_Order";
export const ON_RAMP = "On_Ramp";
export const GET_OPEN_ORDERS = "Get_Open_Orders";
export const GET_INR_BALANCE = "Get_Inr_Balance";

export type MessageFromApi = {
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
}