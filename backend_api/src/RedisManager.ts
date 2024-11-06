import { createClient, RedisClientType } from "redis";
import { MessageFromOrderbook, MessageToEngine } from "./types/variables";

export class RedisManager {
    private client: RedisClientType;
    private publisher: RedisClientType;
    private static instance: RedisManager;

    private constructor(){
        this.client = createClient();
        this.client.connect();
        this.publisher = createClient();
        this.publisher.connect();
    }

    public static getInstance(){
        if(!this.instance){
            this.instance = new RedisManager();
        }
        return this.instance;
    }

    public sendAndAwait(message: MessageToEngine){
        return new Promise<MessageFromOrderbook>((resolve) => {
            const id = this.getRandomClientId();
            this.client.subscribe(id, (message) => {
                this.client.unsubscribe();
                resolve(JSON.parse(message));
            });
            this.publisher.lPush('v2_ot_q', JSON.stringify({ clientId: id, message }))
        })
    }

    public getRandomClientId(){
        return Math.random().toString(36).substring(2,15) + Math.random().toString(36).substring(2, 15);
    }
}