/* global ethers */
const config = window.APP_CONFIG || {};

const RPC_URL = config.rpcUrl || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = config.simpleLotTradeAddress || "";
const TETC_ADDRESS = config.tetcAddress || "";
const TKN10K_ADDRESS = config.tkn10kAddress || "";
const MAX_LEVELS_DEFAULT = config.maxLevels || 25;
const MAX_ORDERS_DEFAULT = config.maxOrders || 50;

const ABI = [
  "function getBuyBook(uint256) view returns (tuple(int256 tick,uint256 price,uint256 totalLots,uint256 totalValue,uint256 orderCount)[] out,uint256 n)",
  "function getSellBook(uint256) view returns (tuple(int256 tick,uint256 price,uint256 totalLots,uint256 totalValue,uint256 orderCount)[] out,uint256 n)",
  "function getBuyOrders(uint256) view returns (tuple(uint256 id,address owner,int256 tick,uint256 price,uint256 lotsRemaining,uint256 valueRemaining)[] out,uint256 n)",
  "function getSellOrders(uint256) view returns (tuple(uint256 id,address owner,int256 tick,uint256 price,uint256 lotsRemaining,uint256 valueRemaining)[] out,uint256 n)",
  "function getOracle() view returns (int256 bestBuyTick,int256 bestSellTick,int256 lastTradeTick,uint256 lastTradeBlock,uint256 lastTradePrice)",
  "function getTopOfBook() view returns (int256 bestBuyTick,uint256 buyLots,uint256 buyOrders,int256 bestSellTick,uint256 sellLots,uint256 sellOrders)",
  "function getEscrowTotals() view returns (uint256 buyTETC,uint256 sellTKN10K)",
  "function priceAtTick(int256 tick) view returns (uint256)",
  "function placeBuy(int256 tick,uint256 lots) returns (uint256)",
  "function placeSell(int256 tick,uint256 lots) returns (uint256)"
];

const ERC20_ABI = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const NONE = -(2n ** 255n);

const el = {
  statusPill: document.getElementById("status-pill"),
  chainStatus: document.getElementById("chain-status"),
  connectBtn: document.getElementById("connect-btn"),
  depthInput: document.getElementById("depth-input"),
  refreshBtn: document.getElementById("refresh-btn"),
  buyBook: document.getElementById("buy-book"),
  sellBook: document.getElementById("sell-book"),
  spreadValue: document.getElementById("spread-value"),
  midTick: document.getElementById("mid-tick"),
  bestBid: document.getElementById("best-bid"),
  bestAsk: document.getElementById("best-ask"),
  lastTrade: document.getElementById("last-trade"),
  escrowTotals: document.getElementById("escrow-totals"),
  midPrice: document.getElementById("mid-price"),
  lastBlock: document.getElementById("last-block"),
  liquidity: document.getElementById("liquidity"),
  sparkline: document.getElementById("sparkline"),
  openOrders: document.getElementById("open-orders"),
  recentTrades: document.getElementById("recent-trades"),
  lastUpdate: document.getElementById("last-update"),
  sideToggle: document.getElementById("side-toggle"),
  tickInput: document.getElementById("tick-input"),
  lotsInput: document.getElementById("lots-input"),
  previewPrice: document.getElementById("preview-price"),
  previewValue: document.getElementById("preview-value"),
  previewBtn: document.getElementById("preview-btn"),
  placeBtn: document.getElementById("place-btn"),
  ticketStatus: document.getElementById("ticket-status")
};

const state = {
  provider: null,
  signer: null,
  readContract: null,
  writeContract: null,
  tetc: null,
  tkn10k: null,
  side: "buy",
  demoMode: false,
  lastTradeTick: null,
  tape: []
};

function toNumber(value) {
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

function formatTetc(value, digits = 4) {
  if (value === null || value === undefined) return "--";
  const numeric = Number(ethers.formatUnits(value, 18));
  if (!Number.isFinite(numeric)) return "--";
  return numeric.toFixed(digits);
}

function formatLots(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return "--";
  return numeric.toString();
}

function formatTick(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return "--";
  return numeric.toString();
}

function shortAddr(addr) {
  if (!addr) return "--";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function setStatus(text, ok) {
  el.statusPill.textContent = text;
  el.statusPill.style.color = ok ? "var(--buy)" : "var(--sell)";
  el.statusPill.style.borderColor = ok ? "rgba(74, 211, 155, 0.4)" : "rgba(255, 107, 107, 0.4)";
  el.statusPill.style.background = ok ? "rgba(74, 211, 155, 0.12)" : "rgba(255, 107, 107, 0.12)";
}

function setTicketStatus(text) {
  el.ticketStatus.textContent = text;
}

function setDemoMode(reason) {
  state.demoMode = true;
  setStatus("Demo mode", false);
  el.chainStatus.textContent = reason || "No RPC";
  renderDemo();
}

function renderDemo() {
  const buy = buildDemoBook("buy");
  const sell = buildDemoBook("sell");
  renderBook(el.buyBook, buy, "buy");
  renderBook(el.sellBook, sell, "sell");
  updateSpread(buy[0], sell[0]);
  renderOrders(buildDemoOrders(), buildDemoOrders(true));
  updateChart(buy, sell);
  el.lastUpdate.textContent = `Last update: demo`;
}

async function initProvider() {
  if (window.ethereum) {
    state.provider = new ethers.BrowserProvider(window.ethereum);
  } else {
    state.provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  state.readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, state.provider);
  if (TETC_ADDRESS) state.tetc = new ethers.Contract(TETC_ADDRESS, ERC20_ABI, state.provider);
  if (TKN10K_ADDRESS) state.tkn10k = new ethers.Contract(TKN10K_ADDRESS, ERC20_ABI, state.provider);
}

async function connectWallet() {
  if (!window.ethereum) {
    setTicketStatus("No injected wallet found.");
    return;
  }
  try {
    if (!state.provider) {
      await initProvider();
    }
    await window.ethereum.request({ method: "eth_requestAccounts" });
    state.signer = await state.provider.getSigner();
    state.writeContract = state.readContract.connect(state.signer);
    const address = await state.signer.getAddress();
    el.connectBtn.textContent = shortAddr(address);
    el.placeBtn.disabled = false;
    setTicketStatus("Wallet connected. Ready to place orders.");
  } catch (err) {
    setTicketStatus(`Wallet error: ${err.message || err}`);
  }
}

function updateSpread(bestBid, bestAsk) {
  if (!bestBid || !bestAsk) {
    el.spreadValue.textContent = "--";
    el.midTick.textContent = "--";
    return;
  }
  const spread = bestAsk.price - bestBid.price;
  const mid = (bestAsk.price + bestBid.price) / 2n;
  el.spreadValue.textContent = `${formatTetc(spread)} TETC`;
  el.midTick.textContent = formatTick((bestAsk.tick + bestBid.tick) / 2n);
  el.midPrice.textContent = `${formatTetc(mid)} TETC`;
}

function renderBook(container, levels, side) {
  if (!levels.length) {
    container.innerHTML = "<div class=\"panel-sub\">No levels.</div>";
    return;
  }
  const maxLots = Math.max(...levels.map((lvl) => toNumber(lvl.totalLots)), 1);
  container.innerHTML = levels
    .map((lvl, idx) => {
      const depth = Math.round((toNumber(lvl.totalLots) / maxLots) * 100);
      const price = formatTetc(lvl.price);
      const lots = formatLots(lvl.totalLots);
      const total = formatTetc(lvl.totalValue);
      return `
        <div class="book-row ${side}${idx === 0 ? " best" : ""}">
          <div class="bar" style="width:${depth}%;${side === "buy" ? "right:0;" : "left:0;"}"></div>
          <span>${price}</span>
          <span>${lots}</span>
          <span>${total}</span>
        </div>
      `;
    })
    .join("");
}

function renderOrders(buyOrders, sellOrders) {
  const rows = [];
  buyOrders.forEach((order) => {
    rows.push({
      side: "buy",
      id: order.id,
      tick: order.tick,
      price: order.price,
      lots: order.lotsRemaining
    });
  });
  sellOrders.forEach((order) => {
    rows.push({
      side: "sell",
      id: order.id,
      tick: order.tick,
      price: order.price,
      lots: order.lotsRemaining
    });
  });
  const limited = rows.slice(0, 12);
  el.openOrders.innerHTML = limited.length
    ? limited
        .map(
          (row) => `
        <div class="table-row orders">
          <span class="tag ${row.side}">${row.side.toUpperCase()}</span>
          <span>#${row.id}</span>
          <span>${formatTick(row.tick)} @ ${formatTetc(row.price)}</span>
          <span>${formatLots(row.lots)} lots</span>
        </div>
      `
        )
        .join("")
    : "<div class=\"panel-sub\">No open orders.</div>";
}

function renderTape() {
  const entries = state.tape.slice(0, 10);
  el.recentTrades.innerHTML = entries.length
    ? entries
        .map(
          (trade) => `
        <div class="table-row">
          <span>${trade.side.toUpperCase()}</span>
          <span>${formatTick(trade.tick)} @ ${formatTetc(trade.price)}</span>
          <span>${formatLots(trade.lots)} lots</span>
        </div>
      `
        )
        .join("")
    : "<div class=\"panel-sub\">No trades yet.</div>";
}

function updateChart(buy, sell) {
  const ctx = el.sparkline.getContext("2d");
  const width = el.sparkline.width;
  const height = el.sparkline.height;
  ctx.clearRect(0, 0, width, height);

  const points = [...sell.slice(0, 8), ...buy.slice(0, 8)]
    .map((lvl) => Number(ethers.formatUnits(lvl.price, 18)))
    .filter((val) => Number.isFinite(val));

  if (!points.length) return;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  ctx.strokeStyle = "rgba(244, 184, 96, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((val, idx) => {
    const x = (idx / (points.length - 1 || 1)) * (width - 20) + 10;
    const y = height - ((val - min) / range) * (height - 40) - 20;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function buildDemoBook(side) {
  const base = side === "buy" ? 120 : 121;
  return Array.from({ length: 10 }, (_, i) => {
    const tick = side === "buy" ? base - i : base + i;
    const price = 500000000000000000n + BigInt(i) * 10000000000000000n;
    const lots = BigInt(60 - i * 4);
    const total = lots * price;
    return {
      tick,
      price,
      totalLots: lots,
      totalValue: total,
      orderCount: BigInt(2 + i)
    };
  });
}

function buildDemoOrders(isSell = false) {
  return Array.from({ length: 6 }, (_, i) => ({
    id: BigInt(300 + i),
    owner: "0x0000000000000000000000000000000000000000",
    tick: BigInt(isSell ? 124 + i : 118 - i),
    price: 520000000000000000n + BigInt(i) * 9000000000000000n,
    lotsRemaining: BigInt(12 + i * 3),
    valueRemaining: BigInt(12 + i * 3) * (520000000000000000n + BigInt(i) * 9000000000000000n)
  }));
}

async function refresh() {
  if (!state.readContract) return;
  const depth = Number(el.depthInput.value) || MAX_LEVELS_DEFAULT;
  const maxOrders = MAX_ORDERS_DEFAULT;

  try {
    const [buyRes, sellRes, oracle, escrow, buyOrdersRes, sellOrdersRes] = await Promise.all([
      state.readContract.getBuyBook(depth),
      state.readContract.getSellBook(depth),
      state.readContract.getOracle(),
      state.readContract.getEscrowTotals(),
      state.readContract.getBuyOrders(maxOrders),
      state.readContract.getSellOrders(maxOrders)
    ]);

    const [buyBook, buyN] = buyRes;
    const [sellBook, sellN] = sellRes;
    const [buyOrders, buyOrdersN] = buyOrdersRes;
    const [sellOrders, sellOrdersN] = sellOrdersRes;

    const buyLevels = buyBook.slice(0, toNumber(buyN));
    const sellLevels = sellBook.slice(0, toNumber(sellN));
    const buyOrdersList = buyOrders.slice(0, toNumber(buyOrdersN));
    const sellOrdersList = sellOrders.slice(0, toNumber(sellOrdersN));

    setStatus("Live", true);
    el.chainStatus.textContent = `RPC ${RPC_URL}`;
    renderBook(el.buyBook, buyLevels, "buy");
    renderBook(el.sellBook, sellLevels, "sell");
    updateSpread(buyLevels[0], sellLevels[0]);
    renderOrders(buyOrdersList, sellOrdersList);
    updateChart(buyLevels, sellLevels);

    const [bestBuyTick, bestSellTick, lastTradeTick, lastTradeBlock, lastTradePrice] = oracle;
    el.bestBid.textContent = bestBuyTick === NONE ? "--" : `${formatTick(bestBuyTick)} @ ${formatTetc(buyLevels[0]?.price || 0n)}`;
    el.bestAsk.textContent = bestSellTick === NONE ? "--" : `${formatTick(bestSellTick)} @ ${formatTetc(sellLevels[0]?.price || 0n)}`;
    el.lastTrade.textContent = `${formatTick(lastTradeTick)} @ ${formatTetc(lastTradePrice)}`;
    el.lastBlock.textContent = lastTradeBlock.toString();

    const [buyTETC, sellTKN10K] = escrow;
    el.escrowTotals.textContent = `${formatTetc(buyTETC)} TETC / ${formatLots(sellTKN10K)} lots`;
    const totalLots = [...buyLevels, ...sellLevels].reduce(
      (acc, lvl) => acc + BigInt(lvl.totalLots),
      0n
    );
    el.liquidity.textContent = `${totalLots.toString()} lots`;

    if (state.lastTradeTick !== null && state.lastTradeTick !== lastTradeTick) {
      state.tape.unshift({
        side: "trade",
        tick: lastTradeTick,
        price: lastTradePrice,
        lots: 1n
      });
    }
    state.lastTradeTick = lastTradeTick;
    renderTape();

    el.lastUpdate.textContent = `Last update: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    setDemoMode(err.message || "RPC error");
  }
}

async function previewOrder() {
  const tick = Number(el.tickInput.value);
  const lots = Number(el.lotsInput.value);
  if (!Number.isFinite(tick) || !Number.isFinite(lots) || lots <= 0) {
    setTicketStatus("Enter a valid tick and lots.");
    return;
  }
  try {
    const price = await state.readContract.priceAtTick(tick);
    const total = price * BigInt(lots);
    el.previewPrice.textContent = `${formatTetc(price)} TETC`;
    el.previewValue.textContent = `${formatTetc(total)} TETC`;
  } catch (err) {
    setTicketStatus(`Preview error: ${err.message || err}`);
  }
}

async function placeOrder() {
  if (!state.writeContract) {
    setTicketStatus("Connect a wallet to trade.");
    return;
  }
  const tick = Number(el.tickInput.value);
  const lots = Number(el.lotsInput.value);
  if (!Number.isFinite(tick) || !Number.isFinite(lots) || lots <= 0) {
    setTicketStatus("Enter a valid tick and lots.");
    return;
  }
  try {
    setTicketStatus("Submitting transaction...");
    const tx =
      state.side === "buy"
        ? await state.writeContract.placeBuy(tick, lots)
        : await state.writeContract.placeSell(tick, lots);
    await tx.wait();
    setTicketStatus("Order placed.");
    await refresh();
  } catch (err) {
    setTicketStatus(`Tx failed: ${err.message || err}`);
  }
}

function bindEvents() {
  el.connectBtn.addEventListener("click", connectWallet);
  el.refreshBtn.addEventListener("click", refresh);
  el.previewBtn.addEventListener("click", previewOrder);
  el.placeBtn.addEventListener("click", placeOrder);
  el.depthInput.addEventListener("change", refresh);

  el.sideToggle.addEventListener("click", (event) => {
    const button = event.target.closest(".seg");
    if (!button) return;
    const side = button.dataset.side;
    state.side = side;
    el.sideToggle.querySelectorAll(".seg").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.side === side);
    });
  });
}

async function boot() {
  bindEvents();
  el.depthInput.value = MAX_LEVELS_DEFAULT.toString();
  try {
    await initProvider();
    await state.provider.getNetwork();
  } catch (err) {
    setDemoMode(err.message || "No provider");
    return;
  }
  await refresh();
  setInterval(refresh, 3000);
}

boot();
