import * as crypto from 'crypto';

export function verifySignature(message: string, signature: string, publickey: string): boolean {
    const verify = crypto.createVerify('SHA256');
    verify.update(message);
    verify.end();
    return verify.verify(publickey, signature, 'base64');
    
}