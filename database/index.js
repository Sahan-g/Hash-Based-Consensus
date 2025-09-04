const {ClassicLevel} = require('classic-level');

const DB_PATH = process.env.DB_PATH || './chaindata';

class BlockchainDB {
    constructor() {
        this.db = new ClassicLevel(DB_PATH, {
            valueEncoding: 'json',
        });
    }

    async saveChain(chain) {
        try {
            await this.db.put("blockchain", chain);
            console.log("Blockchain saved successfully.");
        } catch (error) {
            console.error("Error saving blockchain:", error);
        }
    }

    async getChain() {
        try {
            const chain = await this.db.get("blockchain");
            return chain;

        } catch (error) {
            if (error.code === 'LEVEL_NOT_FOUND') {
                console.log("Blockchain not found in DB, returning empty chain.");
                return null;
            }
        }
    }

    async saveWalletKey(privateKey) {
        try {
            await this.db.put("wallet_key", privateKey);
            console.log("Wallet key saved to DB successfully.");
        } catch (error) {
            console.error('Failed to save wallet key:', error);
        }
    }

    async getWalletKey() {
        try {
            const privateKey = await this.db.get("wallet_key");
            console.log("Wallet key retrieved successfully.");
            return privateKey;
        } catch (error) {
            if(error.code === 'LEVEL_NOT_FOUND') {
                console.log("Wallet key not found in DB, returning null.");
                return null;
            }
            console.error('Failed to retrieve wallet key:', error);
            throw error;
        }
    }
}

module.exports = new BlockchainDB();