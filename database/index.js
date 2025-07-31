
const {ClassicLevel} = require('classic-level');

const DB_PATH = process.env.DB_PATH || './chaindata';

class BlockchainDB {
    constructor() {
        this.db = new ClassicLevel(DB_PATH, {
            valueEncoding: 'json' // automatically handles stringifying and parsing.
        });
    }
    
    async saveChain(chain) {
        try {
            await this.db.put('blockchain', chain);
            console.log('Blockchain saved to DB successfully.');

        } catch (error) {
            console.error('Failed to save blockchain:', error);
        }
    }

    async getChain() {
        try {
            const chain = await this.db.get('blockchain');
            console.log('Loading blockchain from DB...');
            return chain;

        } catch (error) {
            if (error.code==='LEVEL_NOT_FOUND') {
                console.log('Blockchain not found in DB, returning empty chain.');
                return [];
            }
            console.error('Failed to retrieve blockchain:', error);
            throw error;
        }
    }
    
    async saveWalletKey(privateKey) {
        try {
            await this.db.put('wallet_key', privateKey);
            console.log('Wallet key saved to DB.');
        } catch (error) {
            console.error('Failed to save wallet key:', error);
        }
    }

    
    async getWalletKey() {
        try {
            const privateKey = await this.db.get('wallet_key');
            console.log('Loading wallet key from DB...');
            return privateKey;
        } catch (error) {
            if (error.code === 'LEVEL_NOT_FOUND') {
                return null; // Key doesn't exist, which is fine on first startup
            }
            console.error('Failed to retrieve wallet key:', error);
            throw error;
        }
    }
}

module.exports = new BlockchainDB();