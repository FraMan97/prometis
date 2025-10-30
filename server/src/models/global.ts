import NodeCache from "node-cache";

export const activePeersCache = new NodeCache({ 
    stdTTL: 3600,           
    checkperiod: 120,       
    useClones: false        
});

