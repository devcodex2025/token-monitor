const address = "5DQxEQWx7avixWJAqcbYq5672dduBkUf8yi4BZrvpump";
const apiKey = "566d3fba-2dea-40f6-ac27-806702e4339d";
const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${address}/transactions?api-key=${apiKey}`;

fetch(url)
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));

