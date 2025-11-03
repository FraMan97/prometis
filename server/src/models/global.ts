import NodeCache from "node-cache";
import { Request } from 'express';
import rateLimit from 'express-rate-limit';

export const activePeersCache = new NodeCache({ 
    stdTTL: 3600,           
    checkperiod: 120,       
    useClones: false        
});

const senderAddressKeyGenerator = (req: Request): string => {
    const body = req.body as { address?: string };

    if (body && body.address) {
        return body.address;
    }

    return ""; 
};

export const subscriptionLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 3,
    standardHeaders: true, 
    legacyHeaders: false,
    keyGenerator: senderAddressKeyGenerator
});

export const activePeersLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 1000,
    standardHeaders: true, 
    legacyHeaders: false,
});

