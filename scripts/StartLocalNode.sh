core-geth --dev \
  --http --http.addr 127.0.0.1 --http.port 8545 \
  --http.api eth,net,web3 \
  --http.vhosts localhost \
  --http.corsdomain "http://localhost:5173,http://127.0.0.1:5173" \
  --ws --ws.addr 127.0.0.1 --ws.port 8546 \
  --ws.api eth,net,web3 \
  --ws.origins "http://localhost:5173,http://127.0.0.1:5173" \
  --nodiscover --maxpeers 0 \
  --datadir ./chaindata