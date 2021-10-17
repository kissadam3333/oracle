const express = require('express');
const fs = require('fs');
const cors = require('cors');
const Web3 = require('web3');
const db = require('./database');

let port = 80;

// receive args
process.argv.forEach((val, index, array) => {
    if ((val == '-p' || val == '--port') && array[index+1]){
        port = array[index+1];
    }
});

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/:network', cors(), (req, res) => {
    try {
        // fetch blocks from file
        let stats = JSON.parse(fs.readFileSync(`blockStats_${req.params.network}.json`));
        
        // set chosen number of blocks
        let blocks = 200;
        if (req.query.blocks && !isNaN(req.query.blocks)){
            blocks = parseInt(req.query.blocks);
        }

        // slice to last N blocks the stats arrays
        Object.keys(stats).filter(e => Array.isArray(stats[e])).forEach(e => stats[e] = stats[e].slice(-blocks));
        res.send(stats);
    }
    catch (error) {
        res.status(404);
        res.send({
            status: 404,
            error: 'Not found',
            message: 'The network you requested is not available.',
            serverMessage: error,
        });
        return;
    }
});



// get tx info from address
app.get('/tx/:address', cors(), async (req, res) => {
    const fromTime = req.query.fromtime;
    const toTime = req.query.totime;
    const address = req.params.address;

    // check if address is already being monitored
    const addressInfo = (() => {
        let info = await db.getWallet(address);
        if (!info.length){
            await db.monitorWallet(address);
            info = await db.getWallet(address);
        }
        return info[0];
    })();

    // update address blocks scanned
    const rpcs = JSON.parse(fs.readFileSync(`rpcs.json`));
    const networks = Object.keys(rpcs);

    let result = networks.map(async network => {
        try {
            const stats = JSON.parse(fs.readFileSync(`blockStats_${network}.json`));
            const web3 = new Web3(new Web3.providers.HttpProvider(rpcs[network]));
    
            const response = {};

            if (isNaN(toTime) || isNaN(fromTime)){
                return { error: 'Invalid arguments.' };
            }

            // find exact blocks requested by timestamp
            const [fromBlock, toBlock] = ((fromTime, toTime, web3, stats) => {
                let fromBlock = getBlockNumberFromTimestamp(fromTime, web3, stats);
                let toBlock = getBlockNumberFromTimestamp(toTime, web3, stats);
                const blocks = await Promise.all([fromBlock, toBlock]);

                return blocks.map(b => b.error ? { error: b.error} : b.blockNum);
            })(fromTime, toTime, web3, stats);
            
            if (fromBlock.error){
                return fromBlock.error;
            }
            if (toBlock.error){
                return toBlock.error;
            }
            
            const blocks = JSON.parse(addressInfo.blocks_checked)[network] || [];
        
            // expand checked blocks
            const allBLocks = blocks.reduce((p,c) => [...p, ...Array.from({length: c[1] - c[0] + 1}, (_,i) => i + c[0])],[]);
            // list of wanted blocks
            const wanted = Array.from({length: toBlock - fromBlock + 1}, (_,i) => i + fromBlock);
            // pick only the missing blocks from wanted list
            const missing = wanted.filter(e => !allBLocks.includes(e));

            // now I know which blocks I want, update
            let retrievedBlocks = [];
            for (let i in missing){
                retrievedBlocks.push(await web3.eth.getBlock(missing[i]));

                // update each 10 retrieved blocks
                if (retrievedBlocks.length >= 10){
                    await db.updateWallet(addressInfo.wallet, retrievedBlocks, network);
                    retrievedBlocks = [];
                }
            }
            await db.updateWallet(addressInfo.wallet, retrievedBlocks, network);

            const wallet = (await db.getWallet(addressInfo.wallet))[0];
            wallet.blocks_checked = JSON.parse(wallet.blocks_checked);

            response.network = network;
            response.wallet = wallet;

            return response;
        }
        catch(error){
            return { error: error };
        }
    });
    result = await Promise.all(result);

    // get all existing (including recently updated) txs from address
    const txs = await db.getTx(address);

    res.send({
        message: 'success',
        wallet: addressInfo[0].wallet,
        blocksChecked: JSON.parse(addressInfo[0].blocks_checked),
        txs: txs,
    });
});


app.get('/', cors(), (req, res) => {
    res.status(404);
    res.send({
        status: 404,
        error: 'Not found',
        message: 'Nothing to be seen here.',
    });
    return;
});

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});


// --- helper functions ---


// get block number from timestamp
async function getBlockNumberFromTimestamp(timestamp, web3, stats) {
    timestamp = parseInt(timestamp);
    const now = new Date().getTime() / 1000;
    const diffTime = now - timestamp;

    const avgTime = (stats.timestamp.slice(-1)[0] - stats.timestamp[0]) / stats.timestamp.length;
    const lastBlock = await web3.eth.getBlock('latest');
    if (diffTime < 0){
        return { error: 'Time is in the future' };
    }
    else if (lastBlock.timestamp < timestamp){
        return { error: 'Requested time is ahead of last block time' };
    }

    // recursive function find exact block number from given timestamp
    async function getBlock(lastBlock, estBlock) {
        const block = await web3.eth.getBlock(estBlock);
        const timeError = parseInt(block.timestamp) - timestamp;

        const avgTime = (parseInt(block.timestamp) - parseInt(lastBlock.timestamp)) / (parseInt(block.number) - parseInt(lastBlock.number));

        return block.number == lastBlock.number ? block : await getBlock(block, parseInt(parseInt(block.number) - timeError / avgTime));
    }
    const rightBlock = await getBlock(lastBlock, parseInt(parseInt(lastBlock.number) - diffTime / avgTime));

    return {
        timestamp: rightBlock.timestamp,
        blockNum: rightBlock.number,
    };
};
