import * as crypto from 'crypto';

export class KeyPairManager {
    private publicKey: string | undefined;
    private privateKey: string | undefined;
    private static instance: KeyPairManager;

    private constructor() {
        this.generateKeys();
    }

    public static getInstance(): KeyPairManager {
        if (!KeyPairManager.instance) {
            KeyPairManager.instance = new KeyPairManager()
        }
        return KeyPairManager.instance;
    }

    public resetInstance(): void {
        if (KeyPairManager.instance) {
            this.generateKeys();
        }
    }

    public generateKeys(): void {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        this.publicKey = publicKey;
        this.privateKey = privateKey;
    }

    public sign(message: string): string {
        if (!this.privateKey) {
            throw new Error("Private key not found");
        }
        const sign = crypto.createSign('SHA256');
        sign.update(message);
        sign.end();
        const signature = sign.sign(this.privateKey, 'base64');
        return signature;
    }

    public getPublicKey(): string {
        if (!this.publicKey) {
            throw new Error("Public key not found");
        }
        return this.publicKey;
    }

    public getPrivateKey(): string {
        if (!this.privateKey) {
            throw new Error("Private key not found");
        }
        return this.privateKey;
    }
}