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
                break;
            case "Get_Open_Orders":
                const market = message.data.market;
                console.log(this.orderbook[market]);
                RedisManager.getInstance().sendToApi(clientId, {
                    type: "OPEN_ORDERS",
                    payload: {
                        openOrders: this.orderbook[market]
                    }
                })
                break;
            case "Get_Stock_Balance":
                const stockbalance = this.stockBalances.get(message.data.userId);
                if(stockbalance){
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "STOCK_BALANCE",
                        payload: {
                            stockbalance: stockbalance
                        }
                    })   
                    break;
                }else{
                    console.log("stock balance is Null");
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "STOCK_BALANCE",
                        payload: {
                            stockbalance: {}
                        }
                    })   
                    break;
                }
        }   
    }

    getINRBal(userId: string){
        const currentBalance = this.inrBalances.get(userId)?.available;
        if(currentBalance) {
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
            let remainingQty = quantity;
            if(market){
                const priceLevel = type === 'yes' ? market.yes.get(priceInPaise) : market.no.get(priceInPaise);
                if(priceLevel){
                    const availableQty = priceLevel.total;
                    matchedQty = Math.min(availableQty, quantity);
                    this.executeOrder(userId, symbol, type, priceLevel, priceInPaise, matchedQty);
                    remainingQty -= matchedQty;
                    if(!priceLevel.total) market[type].delete(priceInPaise);
                    if(remainingQty){
                        this.createCounterOrder(userId, symbol, type, priceInPaise, remainingQty);
                    }
                    this.publishToWs(symbol);
                    return matchedQty;
                }//from here we create orderbook level by level and generate counter offers
                else{
                    this.createCounterOrder(userId, symbol, type, priceInPaise, quantity);
                }
            }else{
                this.createCounterOrder(userId, symbol, type, priceInPaise, quantity);
            }
        }else{
            const listingType = 'original';
            this.addOrder(userId, symbol, type, priceInPaise, quantity, listingType);
        }
        this.publishToWs(symbol);
        return quantity;
    }

    publishToWs(symbol: string) {
        RedisManager.getInstance().publishMessage(symbol, {
            payload: {
                market: this.orderbook[symbol]
            }
        })
    }


    executeOrder(buyerId: string, symbol: string, type: Ordertype, priceLevel: Order, priceInPaise: number, matchedQty: number){
        priceLevel.total -= matchedQty;
        let remainingQty = matchedQty;
        for(const [sellerId, userRecord] of Object.entries(priceLevel.orders) ){
            const tempMatchQuantity = Math.min(userRecord.quantity, remainingQty);
            //releasing/debiting buyer cash bal
            const buyerINRBal = this.inrBalances.get(buyerId)
            if(buyerINRBal){
                buyerINRBal.locked -= userRecord.quantity * priceInPaise;
            }
            //debiting seller stock bal
            if(userRecord.listingType == 'original') { 
                userRecord.quantity -= tempMatchQuantity;//deleting order
                const sellerStockBal = this.stockBalances.get(sellerId);
                if(sellerStockBal){//releasing stock balance
                    sellerStockBal[symbol][type].locked -= tempMatchQuantity;
                }
                const sellINRBal = this.inrBalances.get(sellerId);
                if(sellINRBal){
                    //crediting seller cash bal
                    sellINRBal.available += tempMatchQuantity * priceInPaise;
                }  
            }else{
                const counterType = type === 'yes' ? 'no' : 'yes';
                //fullfill the original request which was respnsible for the counter order
                this.creditStocks(sellerId, symbol, tempMatchQuantity, counterType);
                const counterCreator = this.inrBalances.get(sellerId);
                if(counterCreator){
                    counterCreator.locked -= priceInPaise * tempMatchQuantity;
                }
            }
            //crediting buyer stock bal 
            this.creditStocks(buyerId, symbol, tempMatchQuantity, type);
            //checking whether we should proceed to the next userRecored in the orderbook or not
            remainingQty -= tempMatchQuantity;
            if(remainingQty) break;  
            console.log("buyer: ",buyerId);
            console.log(this.stockBalances.get(buyerId));
            console.log("seller: ", sellerId);
            console.log(this.stockBalances.get(sellerId));
        }

    }

    addOrder(userId: string, symbol: string, type: Ordertype, price: number, quantity: number, listingType: 'original' | 'reverted'  ){
        if(!this.orderbook[symbol]){//incase of first order for the market 
            this.orderbook[symbol] = { yes: new Map<number, Order>(), no: new Map<number, Order>() }
        }
        let priceLevel = this.orderbook[symbol][type].get(price);
        if(!priceLevel){//incase no order exists for the respective price
            const order: Order = {
                total: 0,
                orders : { 
                    [userId] : { 
                        quantity: 0,
                        listingType: listingType
                    }
                }
            }
            this.orderbook[symbol][type].set(price, order);
            priceLevel = order;
        }
        priceLevel.total += quantity;  
        if(!priceLevel.orders[userId]) {
            priceLevel.orders[userId] = {
                quantity: quantity,
                listingType: listingType
            }
        }else {
            priceLevel.orders[userId].quantity += quantity;
            priceLevel.orders[userId].listingType = listingType;
        }
        console.log("Orderboook after creating order", this.orderbook);
    }

    createCounterOrder(userId: string, symbol: string, type: Ordertype, price: number, quantity: number){
        const counterType = type === 'yes' ? 'no' : 'yes';
        const counterPrice = 1000 - price;
        const listingType = 'reverted';

        // console.log(counterPrice, counterType, listingType);

        this.addOrder(userId, symbol, counterType, counterPrice, quantity, listingType);
        
    }

    checkAndLockBalances(userId: string, symbol: string, type: Ordertype,  side: side, priceInPaise: number, reqQuantity: number){
        const totalPrice = priceInPaise * reqQuantity;
        if(side === 'buy'){
            const inrBalance = this.inrBalances.get(userId);
            //incase inrBalance is null or it is less than required amount
            if(!inrBalance || (inrBalance && (inrBalance.available < totalPrice))){
                throw new Error("Insufficient funds")
            }
            
            //required funds r locked
            if(inrBalance){
                inrBalance.available -= totalPrice;
                inrBalance.locked += totalPrice;
            }
        }else{
            const stockBalance = this.stockBalances.get(userId)?.[symbol][type] ;
            //locking of stocks is done in similar fashion when sell order comes
            if(!stockBalance || (stockBalance.available < reqQuantity)) {
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

    creditStocks(buyerId: string, symbol: string, matchedQuantity: number, type: Ordertype){
        if(!this.stockBalances.get(buyerId)){
            const tempStockBalance: STOCK_BALANCES = type === 'yes' ? {
                [symbol]: {
                    yes: {
                        available: matchedQuantity,
                        locked: 0 
                    },
                    no: {
                        available: 0,
                        locked: 0
                    }
                }
            } : {
                [symbol]: {
                    yes: {
                        available: 0,
                        locked: 0 
                    },
                    no: {
                        available: matchedQuantity,
                        locked: 0
                    }
                }
            }
            this.stockBalances.set(buyerId, tempStockBalance);
            return;
        }
        const userStockBalance = this.stockBalances.get(buyerId);
        if(!userStockBalance)return;

        if(!userStockBalance[symbol]) {
            userStockBalance[symbol] = {
                yes: {
                    available: 0,
                    locked: 0
                },
                no: {
                    available: 0,
                    locked: 0
                }
            }
        }
        userStockBalance[symbol][type].available += matchedQuantity;
    }
}
