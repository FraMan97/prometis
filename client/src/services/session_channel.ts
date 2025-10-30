import * as crypto from 'crypto';
import { KeyPairManager } from './key_manager';

export class SessionChannel {
    private sessionKey: Buffer;
    private publicKeyDest: string;
    private nicknameDest: string;
    private encryptedSessionKey: Buffer;

    constructor(publicKeyDest: string, nicknameDest: string) {
        this.sessionKey = crypto.randomBytes(32);

        const strippedKey = publicKeyDest.replace(/\s/g, '');
        const header = '-----BEGIN PUBLIC KEY-----';
        const footer = '-----END PUBLIC KEY-----';

        let pemBody = strippedKey
            .replace(header.replace(/\s/g, ''), '')
            .replace(footer.replace(/\s/g, ''), '');

        this.publicKeyDest = `${header}\n${pemBody}\n${footer}`;
        this.nicknameDest = nicknameDest;
        this.encryptedSessionKey = this.encryptSessionKey();
    }

    public getSessionKey(): Buffer {
        return this.sessionKey;
    }

    public getEncryptedSessionKey(): Buffer {
        return this.encryptedSessionKey;
    }

    public getPublicKeyDest(): string {
        return this.publicKeyDest;
    }

    public getNicknameDest(): string {
        return this.nicknameDest;
    }

    public setSessionKey(sessionKey: Buffer): void {
        this.sessionKey = sessionKey;
    }

    public setEncryptedSessionKey(encryptedSessionKey: Buffer): void {
        this.encryptedSessionKey = encryptedSessionKey;
    }

    public encryptMessage(message: string): {
        encryptedData: string;
        iv: string
    } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', this.sessionKey, iv);
        let encryptedData = cipher.update(message, 'utf8', 'base64');
        encryptedData += cipher.final('base64');

        return {
            encryptedData,
            iv: iv.toString('base64')
        };
    }

    public decryptMessage(encryptedData: string, iv: string): string {
        const ivBuffer = Buffer.from(iv, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.sessionKey, ivBuffer);
        let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
        decryptedData += decipher.final('utf8');

        return decryptedData;
    }

    public encryptSessionKey(): Buffer {
        const encryptedKey = crypto.publicEncrypt(
            {
                key: this.publicKeyDest,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            this.sessionKey
        );

        return encryptedKey;
    }

    public decryptEncryptedSessionKey(): Buffer {
        const decryptedKey: Buffer = crypto.privateDecrypt(
            {
                key: KeyPairManager.getInstance().getPrivateKey(),
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            this.encryptedSessionKey
        );

        return decryptedKey;
    }
}