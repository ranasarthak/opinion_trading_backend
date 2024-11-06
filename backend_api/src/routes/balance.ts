import { Router } from "express";
import { RedisManager } from "../RedisManager";
import { GET_INR_BALANCE, ON_RAMP } from "../types/variables";

export const balanceRouter = Router();

balanceRouter.get('/inr', async(req, res) => {
    const { userId } = req.body;
    const response = await RedisManager.getInstance().sendAndAwait({
        type: GET_INR_BALANCE,
        data: {
            userId
        }
    });
    console.log(response);
    res.json(response.payload);
})

balanceRouter.post('/onramp', async(req, res) => {
    const { userId, amount } = req.body;
    try{
        const response = await RedisManager.getInstance().sendAndAwait({
            type: ON_RAMP,
            data: {
                userId,
                amount
            }
        });
        console.log(response);
        res.json('empty');
    }catch(e){
        console.log(e);
    }
})

// balanceRouter.get('/stocks', async(req, res) => {
//     const { userId } = req.body;
//     const response = await RedisManager.getInstance().sendAndAwait({
//         type
//     })
// })