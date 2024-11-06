import { createClient, RedisClientType } from "redis";
import { MessageToApi } from "./types/toApi";
import { MessageToWs } from "./types/toWS";

export class RedisManager {
    private client : RedisClientType;
    private static instance: RedisManager;

    constructor(){
        this.client = createClient();
        this.client.connect();
    }

    public static getInstance() {
        if(!this.instance){
            this.instance = new RedisManager;
        }
        return this.instance;
    }

    public publishMessage(channel: string, message: MessageToWs) {
        this.client.publish(channel, JSON.stringify(message));
    }

    public sendToApi(clientId: string, message: MessageToApi) {
        this.client.publish(clientId, JSON.stringify(message));
    }


}