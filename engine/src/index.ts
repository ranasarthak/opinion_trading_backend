import { createClient } from "redis"
import { Engine } from "./trade/engine";

async function main() {
    const engine = new Engine();
    const redisClient = createClient();
    await redisClient.connect();
    console.log('Redis connected successfully');

    while(true){
        const response = await redisClient.rPop("v2_ot_q" as string);
        if(!response){

        }else{
            engine.process(JSON.parse(response));
        }
    }
}

main();