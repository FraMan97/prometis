export class Message{
    private sender: string;
    private message: string;

    constructor(sender: string, message: string){
        this.sender = sender;
        this.message = message;
    }

    public getMessage(): string {
        return this.message;
    }

    public getSender(): string {
        return this.sender;
    }
}