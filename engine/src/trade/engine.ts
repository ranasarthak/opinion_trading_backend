import { RedisManager } from "../RedisManager";
import { MessageFromApi } from "../types/fromApi";
import { INRBalance, Order, OrderBook, Ordertype, side, STOCK_BALANCES, StockBalance } from "./Orderbook";


export class Engine{
 private orderbook: OrderBook = {};
 private inrBalances: Map<string, INRBalance> = new Map();
 private stockBalances: Map<string, STOCK_BALANCES> = new Map();

    process({ message, clientId }: { message: MessageFromApi, clientId: string }  ){
        switch(message.type){
            case "Create_Order":
                try{
                    const executedQty = this.createOrder(message.data.market, message.data.userId, message.data.stockType, message.data.side, message.data.quantity, message.data.price)
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_PLACED",
                        payload: {
                            executedQty: executedQty
                        }
                    })
                }catch(error){
                    console.log(error);
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_CANCELLED",
                        payload: {
                            executedQty: 0
                        }
                    })
                }
                break;
            case "On_Ramp":
                const updatedBalance = this.onRamp(message.data.amount, message.data.userId);
                RedisManager.getInstance().sendToApi(clientId, {
                    type: "BALANCE_UPDATED",
                    payload: {
                        updatedBalance: updatedBalance as number
                    }
                })
                break;
            case "Get_Inr_Balance":
                const currentBalance = this.getINRBal(message.data.userId);
                RedisManager.getInstance().sendToApi(clientId, {
                    type: "CURRENT_BALANCE",
                    payload: {
                        currentBalance: currentBalance
                    }
                })
        }
    }

    getINRBal(userId: string){
        const currentBalance = this.inrBalances.get(userId)?.available;
        if(currentBalance){
            return currentBalance;
        }

        return 0;  
    }

    createOrder(symbol: string, userId: string, type: Ordertype, side: side, quantity: number, price: number ){
        const priceInPaise = price * 100;
        
        try{
            this.checkAndLockBalances(userId, symbol, type, side, priceInPaise, quantity);
        }catch(error){
            console.log(error);
            return 0;
        }
        if(side === 'buy'){
            const market = this.orderbook[symbol];
            let matchedQty = 0;
            if(market){
                const priceLevel = type === 'yes' ? market.yes.get(priceInPaise) : market.no.get(priceInPaise);
                if(priceLevel){
                    const availableQty = priceLevel.total;
                    matchedQty = Math.min(availableQty, quantity);
                    this.executeOrder(userId, symbol, type, priceLevel, priceInPaise, matchedQty);
                    const remainingQty = quantity - availableQty;
                    if(remainingQty){
                        this.createCounterOrder(userId, symbol, type, priceInPaise, remainingQty);
                    }
                    // return matchedQty;
                }else{
                    this.createCounterOrder(userId, symbol, type, priceInPaise, quantity);
                }
            }else{
                this.createCounterOrder(userId, symbol, type, priceInPaise, quantity);
            }
        }else{
            const userStocks = this.stockBalances.get(userId);
            if(userStocks){
                userStocks[symbol][type].available -= quantity;
                userStocks[symbol][type].locked += quantity;
            }
            const listingType = 'original';
            this.addOrder(userId, symbol, type, priceInPaise, quantity, listingType);
        }
        return quantity;
    }


    executeOrder(buyerId: string, symbol: string, type: Ordertype, priceLevel: Order, priceInPaise: number, matchedQty: number){
        priceLevel.total -= matchedQty;
        let remainingQty = matchedQty;
        for(const [sellerId, userRecord] of Object.entries(priceLevel.orders) ){
            const buyerINRBal = this.inrBalances.get(buyerId)

            if(buyerINRBal){
                //releasing/debiting buyer cash bal
                buyerINRBal.locked -= userRecord.quantity * priceInPaise;
            }

            const buyerStockBal = this.stockBalances.get(buyerId)?.[symbol][type];
            if(buyerStockBal){
                //crediting buyer stock bal
                buyerStockBal.available += matchedQty;
            }
            //debiting seller stock bal
            userRecord.quantity -= matchedQty;
            if(userRecord.listingType == 'original') { 
                const sellINRBal = this.inrBalances.get(sellerId);
                if(sellINRBal){
                    //crediting seller cash bal
                    sellINRBal.available += userRecord.quantity * priceInPaise;
                }  
            }else{
                const counterType = type === 'yes' ? 'no' : 'yes';
                //fullfill the original request which was respnsible for the counter order
                const originalOrder = this.stockBalances.get(sellerId)?.[symbol][counterType];
                const currentMatches = Math.min(userRecord.quantity, matchedQty);
                if(originalOrder){
                    originalOrder.available += currentMatches
                }
                const counterCreator = this.inrBalances.get(sellerId);
                if(counterCreator){
                    counterCreator.locked -= priceInPaise * currentMatches
                }
            }
            
            //checking whether we should proceed to the next userRecored in the orderbook or not
            if(userRecord.quantity > remainingQty){
                break;
            }
            remainingQty -= userRecord.quantity;       
        }
    }

    addOrder(userId: string, symbol: string, type: Ordertype, price: number, quantity: number, listingType: 'original' | 'reverted'  ){
        if(!this.orderbook[symbol]){
            this.orderbook[symbol] = { yes: new Map<number, Order>(), no: new Map<number, Order>() }
        }
        const priceLevel = this.orderbook[symbol][type].get(price);
        if(!priceLevel){
            this.orderbook[symbol][type].set(price, {
                total: quantity,
                orders : { 
                    userId : { 
                        quantity: quantity,
                        listingType: listingType
                    }
                }
            })
        }
        else{
            priceLevel.total += quantity;
            const userRecord = priceLevel.orders[userId];
            if(!userRecord) {
                priceLevel.orders[userId].quantity = quantity;

            }else{
                userRecord.quantity += quantity;
            }
            priceLevel.orders[userId].listingType = listingType;
        }        
        console.log(this.orderbook);
    }

    createCounterOrder(userId: string, symbol: string, type: Ordertype, price: number, quantity: number){
        const counterType = type === 'yes' ? 'no' : 'yes';
        const counterPrice = 1000 - price;
        const listingType = 'reverted';

        this.addOrder(userId, symbol, counterType, counterPrice, quantity, listingType);
        
    }

    checkAndLockBalances(userId: string, symbol: string, type: Ordertype,  side: side, priceInPaise: number, reqQuantity: number){
        const totalPrice = priceInPaise * reqQuantity;
        if(side === 'buy'){
            const inrBalance = this.inrBalances.get(userId);
            if(!inrBalance || (inrBalance && (inrBalance.available < totalPrice))){
                throw new Error("Insufficient funds")
            }
        
            if(inrBalance){
                inrBalance.available -= totalPrice;
                inrBalance.locked += totalPrice;
            }
        }else{
            const stockBalance = this.stockBalances.get(userId)?.[symbol][type] ;
            if(stockBalance && (stockBalance.available < reqQuantity)) {
                throw new Error("Insufficient stock balance");
            }
            if(stockBalance){
                stockBalance.available -= reqQuantity;
                stockBalance.locked += reqQuantity;
            }
        }
        return;
    }

    onRamp(amount: number, userId: string) {
        const amountInPaise = amount * 100;
        let userBalance = this.inrBalances.get(userId);
        if(!userBalance) {
            this.inrBalances.set(userId, { 
                available: amountInPaise,
                locked: 0
            })
            userBalance =this.inrBalances.get(userId);
        }
        else {
            userBalance.available += amountInPaise;
        }
        return userBalance?.available;
        
    }
}