import { WebSocket } from "ws";
import { IncommingMessage, SUBSCRIBE, UNSUBSCRIBE } from "./types/in";
import { OutgoingMessage } from "http";
import { SubscriptionManager } from "./SubsciptionManager";

export class User {
    private id: string;
    private ws: WebSocket;

    constructor(id: string, ws: WebSocket){
        this.id = id;
        this.ws = ws;
        this.addListneres();
    } 

    emit(message: OutgoingMessage) {
        this.ws.send(JSON.stringify(message))
    }

    private addListneres() {
        console.log("addListneres");
        this.ws.on("message",(message: string) => {
            const parsedMessage: IncommingMessage = JSON.parse(message);
            if(parsedMessage.method === SUBSCRIBE){
                parsedMessage.params.forEach(s => SubscriptionManager.getInstance().subscribe(this.id, s));
            }

            if(parsedMessage.method === UNSUBSCRIBE){
                parsedMessage.params.forEach(s => SubscriptionManager.getInstance().unsubscribe(this.id, parsedMessage.params[0]));
            }
        })
    }
}

