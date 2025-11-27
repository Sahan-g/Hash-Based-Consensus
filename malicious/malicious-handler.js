class MaliciousHandler {
    constructor() {
        this.maliciousCount = {};
        this.blacklisted = new Set();
    }

    async loadMaliciousDataFromDb() {
        const maliciousData = await db.getMaliciousNodes();
        this.maliciousCount = maliciousData.counts || {};
        this.blacklisted = new Set(maliciousData.blacklisted || []);
        console.log("🚀 Loaded malicious node data from DB:", maliciousData);
    }
}
module.exports = MaliciousHandler;