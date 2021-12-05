<p align=center>
<img width="800" src="https://user-images.githubusercontent.com/19828711/140464079-683afdb2-a213-4e02-a032-93a42e3a93e8.png">
</p>

# Owlracle Web

Owlracle is a tool for generating statistics concerning gas price estimations for several norworks. It retrieve raw information from web3 RPCs and feed it to [Owlracle](https://owlracle.info) and [Bscgas](https://bscgas.info) websites.

## Motivation

When the dawn of smart networks arrived, dapp developers saw the need to know the [gas price](https://en.wikipedia.org/wiki/Ethereum#Gas) they should pay for submitting a transaction in those networks. While those developers could fetch the last transactions and look at the gas price paid, this method is not reliable enough as gas prices wildly fluctuate between each transaction. So the gas price oracles arrived to help solving this problem. 

Inspired by works like [ethgasstation](https://ethgasstation.info/), I have decided to create a gas price oracle working on several networks. Right now we provide estimations for Ethereum, Binance Smart Chain, Polygon, Fantom and Avalanche networks. Services like owlracle are a way to remove this burden from your servers (this can be somewhat resource-intensive), while providing API to help integrate your dapps to our predictions.

## Installation

Clone this repo:
```
git clone https://github.com/owlracle/oracle.git
```

Install dependencies:
```
npm install
```

Also make sure you have [pm2](https://pm2.keymetrics.io/) installed.

## Default usage

Run oracles for each network and server exposing the service:
```
pm2 start pm2.json
```

## Running custom networks 

RPCs addresses are stored in ```rpcs.json``` if you want to add, change or remove any of them.

For running a custom network oracle, run:

```
node oracle.js -n [network] -t [interval]
```

Where:
* ```network``` is the network name present in the RPCs json file
* ```interval``` is the time (in ms) between each check for new blocks on that network. Note that you must specify an interval lower than the network's average block time.

For running the server, use:

```
node server.js -p [port]
```

Where ```port``` is the port you wish to expose the API containing every oracle's retrieved information.

After those steps you will have one oracle process for each network and a server process for serving the API.


## API

For consuming the oracle API, fetch the ```/[network]``` endpoint using a ```GET``` request, where ```network``` is the same network name as the running oracle and the network name in the rpcs file.

The request will retrieve information from the chosen network, and it can have the following query parameters:

* ```blocks```: How many blocks in the past you want to get information from? _Default 200_. _Maximum 1000_.
* ```nth```: How many of the lowest gas priced transactions you want to consider when determining the lowest gas price accepted on each block? If informed a value between 0 and 1 it will be considered a percentage value (as in % of blocks). _Default 0.3_.

On a successful request, a json will be returned with the following fields:

* ```ntx```: **number array**. Transaction count from each block;
* ```timestamp```: **number array**. UNIX timestamp of the mined time from each block;
* ```minGwei```: **number array**. The minimum gas accepted (influenced by ```nth``` argument) by each block;
* ```avgGas```: **number array**. Average gas used on transactions for each block;
* ```lastBlock```: **number**. Last block number retrieved by the oracle.

### Sample response

```
{
  "ntx": [3,4,2,5,3],
  "timestamp": [123,123,123,123,123],
  "minGwei": [1,2,1,3,2],
  "avgGas": [10000,10000,10000,10000,10000],
  "lastBlock": 12345
}
```

---

<a href="https://twitter.com/owlracleAPI">
<img src="https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white">
</a>

<a href="https://facebook.com/owlracle">
<img src="https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white">
</a>

<a href="https://t.me/owlracle">
<img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white">
</a>

<a href="https://github.com/owlracle">
<img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white">
</a>

---

Support our project! We accept any token donation on <img src="https://owlracle.info/img/bsc.png" height="20"> **BSC**, <img src="https://owlracle.info/img/poly.png" height="20"> **Polygon**, <img src="https://owlracle.info/img/ftm.png" height="20"> **Fantom**, <img src="https://owlracle.info/img/eth.png" height="20"> **Ethereum**, and <img src="https://owlracle.info/img/avax.png" height="20"> **Avalanche** networks.

<a href="https://user-images.githubusercontent.com/19828711/139945432-f6b07860-c986-4221-a291-10370f24ea5a.png">
<h3 align=center><img src="https://img.shields.io/badge/Wallet-0xA6E126a5bA7aE209A92b16fcf464E502f27fb658-blue"></h3>
<p align=center>
	<img width="200" src="https://user-images.githubusercontent.com/19828711/139945432-f6b07860-c986-4221-a291-10370f24ea5a.png">
</p>
</a>
