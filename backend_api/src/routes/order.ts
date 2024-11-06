import { Router } from "express";
import { RedisManager } from "../RedisManager";
import { CANCEL_ORDER, CREATE_ORDER, GET_OPEN_ORDERS } from "../types/variables";

export const orderRouter = Router();

orderRouter.post('/', async(req, res) => {
    const { market , price, stockType, quantity, side, userId } = req.body;
    console.log({ market, price, quantity, side, userId});

    const reponse = await RedisManager.getInstance().sendAndAwait({
        type: CREATE_ORDER,
        data: {
            market,
            price,
            stockType,
            quantity,
            side,
            userId
        }
    });
    res.json(reponse.payload);
});


orderRouter.delete('/', async(req, res) => {
    const { market, userId, quantity } = req.body;

    const response =  await RedisManager.getInstance().sendAndAwait({
        type: CANCEL_ORDER,
        data: {
            userId,
            market
        }
    });
    res.json(response.payload);
});


orderRouter.get('/', async(req, res) => {
    const response = await RedisManager.getInstance().sendAndAwait({
        type: GET_OPEN_ORDERS,
        data: {
            market: req.query.market as string
        }
    });
    res.json(response.payload);
})