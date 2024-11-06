export type Ordertype = 'yes' | 'no';
export type ListingType = 'original' | 'counter';
export type side = 'buy' | 'sell';

export interface INRBalance {
    available: number;
    locked: number;
}

export interface StockBalance {
    available: number;
    locked: number;
}

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

export interface CounterOffer {
    id: string;
    userId: string;
    stockSymbol: string;
    type: 'yes' | 'no';
    quantity: number;
    price: number;
}

export interface STOCK_BALANCES { 
    [symbol: string] : {
        yes: StockBalance;
        no: StockBalance
    }
} 

export const COUNTER_OFFERS: CounterOffer[] = [];
