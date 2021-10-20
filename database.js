const sqlite3 = require('sqlite3').verbose();

const db = {
    init: function() {
        const timeAlive = new Date().getTime() - (this.alive || 0);
        // 5 minutes, too old
        if (this.started && timeAlive > 1000 * 60 * 5){
            this.db.close();
            this.started = false;
        }
        if (!this.started){ // 5 minutes
            this.db = new sqlite3.Database('db_file');
            this.started = true;
            this.alive = new Date().getTime();
        }

        return this.db;
    },

    // create database and tables
    createTables: function() {
        console.log('CREATING TABLES');
    
        const db = this.init();
        db.serialize(() => {
            db.run(`DROP TABLE IF EXISTS wallets`);
            db.run(`CREATE TABLE wallets (
                wallet VARCHAR(42) PRIMARY KEY,
                blocks_checked TEXT DEFAULT "{}"
            )`);
    
            db.run(`DROP TABLE IF EXISTS transactions`);
            db.run(`CREATE TABLE transactions (
                tx VARCHAR(66) PRIMARY KEY,
                towallet VARCHAR(42),
                fromwallet VARCHAR(42),
                block INT,
                value DECIMAL(15,0),
                timestamp TIMESTAMP,
                network VARCHAR(10),
                FOREIGN KEY (towallet) REFERENCES wallets(wallet)
            )`);
        });
    },
    
    monitorWallet: async function(wallets) {
        wallets = (Array.isArray(wallets) ? wallets : [wallets]).map(e => e.toLowerCase());
    
        const existing = (await this.getWallet()).map(e => e.wallet);
        wallets = wallets.filter(e => !existing.includes(e));

        const db = this.init();
        db.serialize(() => {
            const stmt = db.prepare("INSERT INTO wallets (wallet) VALUES (?)");
            wallets.forEach(w => stmt.run(w));
            stmt.finalize();
        });

        return { message: 'success', wallets: wallets };
    },
    
    getWallet: async function(wallets) {
        if (wallets){
            wallets = (Array.isArray(wallets) ? wallets : [wallets]).map(e => e.toLowerCase());
        }

        const db = this.init();
        let result = new Promise(resolve => {
            db.serialize(() => {
                if (wallets){
                    const stmt = db.prepare(`SELECT * FROM wallets WHERE wallet IN(?)`);
                    stmt.all(wallets, (err, rows) => {
                        resolve(rows);
                    });
                    stmt.finalize();
                }
                else {
                    db.all("SELECT * FROM wallets", (err, rows) => {
                        resolve(rows);
                    });
                }
            });
        });

        return await result;
    },

    getTx: async function(wallets) {
        if (wallets){
            wallets = (Array.isArray(wallets) ? wallets : [wallets]).map(e => e.toLowerCase());
        }

        const db = this.init();
        let result = new Promise(resolve => {
            db.serialize(() => {
                if (wallets){
                    const stmt = db.prepare(`SELECT * FROM transactions WHERE towallet IN(?) ORDER BY timestamp DESC`);
                    stmt.all(wallets, (err, rows) => {
                        resolve(rows);
                    });
                    stmt.finalize();
                }
                else {
                    db.all("SELECT * FROM transactions ORDER BY timestamp DESC", (err, rows) => {
                        resolve(rows);
                    });
                }
            });
        });

        return await result;
    },

    updateWallets: async function(blocks, network){
        const db = this.init();

        const wallets = await this.getWallet();
        if (!wallets.length){
            return { error: `No wallets found` };
        }

        blocks = Array.isArray(blocks) ? blocks : [blocks];

        const insertSql = db.prepare('INSERT INTO transactions (tx, towallet, fromwallet, block, value, timestamp, network) VALUES (?,?,?,?,?,?,?)');
        const updateSql = db.prepare('UPDATE wallets SET blocks_checked = ? WHERE wallet = ?');

        await Promise.all(wallets.map(async wallet => {
            const allTx = await this.getTx(wallet.wallet);
        
            for (let i in blocks){
                const block = blocks[i];
    
                await new Promise(resolve => db.serialize(() => {
                    block.transactions.forEach(t => {
                        // transaction not already included and to monitored wallet
                        if (!allTx.includes(t.hash) && t.to && wallet.wallet == t.to.toLowerCase()) {
                            insertSql.run([
                                t.hash,
                                t.to.toLowerCase(),
                                t.from.toLowerCase(),
                                block.number,
                                parseFloat(t.value) * 0.000000001,
                                block.timestamp,
                                args.network,
                            ]);
                        }
                    });
                    resolve(true);
                }));
            }
    
            const blocksNum = blocks.map(e => e.number);
    
            let checked = JSON.parse(wallet.blocks_checked)[network] || [];
            // expand all checked blocks
            let allBlocks = checked.reduce((p,c) => [...p, ...Array.from({length: c[1] - c[0] + 1}, (_,i) => i + c[0])], []);
            // insert into allblocks
    
            allBlocks.push(...blocksNum.filter(e => !allBlocks.includes(e)));
            allBlocks = allBlocks.sort((a,b) => a-b);
    
            // shrink allblocks again
            checked = (c => {
                const groups = [];
                let gi = 0;
                for (let i in c){
                    if (groups.length == gi){
                        groups.push([]);
                        groups[gi] = [c[i], c[i]];
                    }
                    else if (c[i] == groups[gi][1] + 1){
                        groups[gi][1]++;
                    }
                    else {
                        gi++;
                        groups.push([]);
                        groups[gi] = [c[i], c[i]];
                    }
                }
                return groups;
            })(allBlocks);
    
            const bc = JSON.parse(wallet.blocks_checked) || {};
            bc[network] = checked;    
            updateSql.run([ JSON.stringify(bc), wallet.wallet ]);
        }));
        
        insertSql.finalize();
        updateSql.finalize();

        return { message: 'success' };
    },
};

module.exports = db;
