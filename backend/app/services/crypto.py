"""Crypto prices via CoinGecko (free, no API key for basic use). Simulated aggressive buy/sell."""

import json
import requests

# CoinGecko API (free tier, no key required for simple/price)
COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# Map common symbols and names to CoinGecko id
SYMBOL_TO_ID = {
    "btc": "bitcoin",
    "bitcoin": "bitcoin",
    "eth": "ethereum",
    "ethereum": "ethereum",
    "sol": "solana",
    "solana": "solana",
    "doge": "dogecoin",
    "dogecoin": "dogecoin",
    "xrp": "ripple",
    "ripple": "ripple",
    "ada": "cardano",
    "cardano": "cardano",
    "dot": "polkadot",
    "polkadot": "polkadot",
    "avax": "avalanche-2",
    "avalanche": "avalanche-2",
    "link": "chainlink",
    "chainlink": "chainlink",
    "matic": "matic-network",
    "polygon": "matic-network",
    "uni": "uniswap",
    "uniswap": "uniswap",
    "shib": "shiba-inu",
    "shiba": "shiba-inu",
    "shiba inu": "shiba-inu",
    "ltc": "litecoin",
    "litecoin": "litecoin",
    "bnb": "binancecoin",
    "binance": "binancecoin",
    "busd": "binance-usd",
    "usdc": "usd-coin",
    "usdt": "tether",
    "tether": "tether",
}


def _normalize_symbol(s: str) -> str:
    return (s or "").strip().lower().replace(" ", "-")


def get_crypto_price(symbol_or_id: str, vs_currency: str = "usd") -> str:
    """
    Get current price and 24h change for a cryptocurrency.
    symbol_or_id: e.g. "btc", "bitcoin", "eth", "ethereum", "sol", "doge".
    Returns a short summary string or an error message.
    """
    raw = _normalize_symbol(symbol_or_id)
    if not raw:
        return "Error: no coin specified. Use a symbol (e.g. btc, eth, sol, doge) or name (e.g. bitcoin, ethereum)."

    coin_id = SYMBOL_TO_ID.get(raw)
    if not coin_id:
        # Try using as id directly (e.g. "bitcoin")
        coin_id = raw.replace(" ", "-")

    try:
        r = requests.get(
            f"{COINGECKO_BASE}/simple/price",
            params={
                "ids": coin_id,
                "vs_currencies": vs_currency,
                "include_24hr_change": "true",
                "include_24hr_vol": "false",
                "include_last_updated_at": "true",
            },
            timeout=10,
            headers={"Accept": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        if not data or coin_id not in data:
            return f"Coin not found: '{symbol_or_id}'. Try btc, eth, sol, doge, ada, xrp, link, avax, matic, shib, etc."
        info = data[coin_id]
        price = info.get(vs_currency)
        change_24h = info.get(f"{vs_currency}_24h_change")
        if price is None:
            return f"No price for {symbol_or_id} in {vs_currency}."
        out = f"{coin_id}: {vs_currency.upper()} {price:,.2f}"
        if change_24h is not None:
            out += f" (24h: {change_24h:+.2f}%)"
        out += "."
        return out
    except requests.RequestException as e:
        return f"Crypto API error: {e!s}"
    except Exception as e:
        return f"Crypto error: {e!s}"


# In-memory simulated positions (for demo only; resets on restart)
_SIMULATED_PORTFOLIO = {}
_SIMULATED_TRADES = []


def buy_crypto(symbol: str, amount_usd: float) -> str:
    """
    Simulated BUY. Records an aggressive buy and returns a confirmation message.
    amount_usd: how much USD to "spend" (simulated).
    """
    symbol = _normalize_symbol(symbol)
    coin_id = SYMBOL_TO_ID.get(symbol) or symbol.replace(" ", "-")
    try:
        amt = float(amount_usd)
        if amt <= 0:
            return "Invalid amount. Use a positive number (e.g. 100)."
    except (TypeError, ValueError):
        return "Invalid amount. Pass amount_usd as a number (e.g. 500)."

    price_str = get_crypto_price(coin_id)
    if "error" in price_str.lower() or "not found" in price_str.lower():
        return f"Cannot buy: {price_str}"

    # Parse price from our own response for simulated quantity
    try:
        r = requests.get(
            f"{COINGECKO_BASE}/simple/price",
            params={"ids": coin_id, "vs_currencies": "usd"},
            timeout=5,
        )
        r.raise_for_status()
        data = r.json()
        price = (data.get(coin_id) or {}).get("usd") or 0
    except Exception:
        price = 0
    if not price:
        return f"Could not get price for {coin_id}. Try again."
    qty = amt / price
    _SIMULATED_PORTFOLIO[coin_id] = _SIMULATED_PORTFOLIO.get(coin_id, 0) + qty
    _SIMULATED_TRADES.append({"action": "BUY", "coin": coin_id, "usd": amt, "qty": qty})
    return (
        f"EXECUTED BUY: {amt:,.2f} USD of {coin_id.upper()} @ {price:,.2f} USD → {qty:.6f} {coin_id}. "
        "Position updated. THIS IS SIMULATED—no real money was used."
    )


def sell_crypto(symbol: str, amount_usd_or_all: str) -> str:
    """
    Simulated SELL. amount_usd_or_all: number (USD to sell) or "all" / "ALL" to sell full position.
    """
    symbol = _normalize_symbol(symbol)
    coin_id = SYMBOL_TO_ID.get(symbol) or symbol.replace(" ", "-")
    position = _SIMULATED_PORTFOLIO.get(coin_id, 0)
    if position <= 0:
        return (
            f"You have no position in {coin_id}. Current simulated portfolio: {json.dumps(_SIMULATED_PORTFOLIO)}. "
            "BUY first if you want to sell later."
        )
    try:
        r = requests.get(
            f"{COINGECKO_BASE}/simple/price",
            params={"ids": coin_id, "vs_currencies": "usd"},
            timeout=5,
        )
        r.raise_for_status()
        price = (r.json().get(coin_id) or {}).get("usd") or 0
    except Exception:
        price = 0
    if not price:
        return f"Could not get price for {coin_id}. Try again."
    value_usd = position * price
    sell_all = str(amount_usd_or_all).strip().lower() in ("all", "max", "everything")
    if sell_all:
        usd_sold = value_usd
        qty_sold = position
        _SIMULATED_PORTFOLIO[coin_id] = 0
    else:
        try:
            usd_sold = float(amount_usd_or_all)
            if usd_sold <= 0:
                return "Invalid amount. Use a positive number or 'all'."
            if usd_sold >= value_usd:
                usd_sold = value_usd
                qty_sold = position
                _SIMULATED_PORTFOLIO[coin_id] = 0
            else:
                qty_sold = usd_sold / price
                _SIMULATED_PORTFOLIO[coin_id] = position - qty_sold
        except (TypeError, ValueError):
            return "Invalid amount. Pass a number (USD to sell) or 'all' to sell entire position."
    _SIMULATED_TRADES.append({"action": "SELL", "coin": coin_id, "usd": usd_sold, "qty": qty_sold})
    return (
        f"EXECUTED SELL: {qty_sold:.6f} {coin_id} → {usd_sold:,.2f} USD. "
        "Position updated. THIS IS SIMULATED—no real money was used."
    )


def get_portfolio_summary() -> str:
    """Return a short summary of simulated positions and recent trades."""
    if not _SIMULATED_PORTFOLIO and not _SIMULATED_TRADES:
        return "No positions and no trades yet. Use buy_crypto to buy and sell_crypto to sell (simulated)."
    lines = []
    if _SIMULATED_PORTFOLIO:
        lines.append("Positions: " + json.dumps({k: round(v, 6) for k, v in _SIMULATED_PORTFOLIO.items() if v > 0}))
    if _SIMULATED_TRADES:
        last = _SIMULATED_TRADES[-5:]
        lines.append("Last trades: " + json.dumps(last))
    return " ".join(lines)
