const express = require('express')
const fs = require('fs');
const cors = require('cors')

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

app.get('/', cors(), (req, res) => {
    res.status(404);
    res.send({
        status: 404,
        error: 'Not found',
        message: 'Nothing to be seen here.',
        serverMessage: error,
    });
    return;
});

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});
