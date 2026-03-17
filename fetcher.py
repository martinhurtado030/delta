#!/usr/bin/env python3
"""
DELTA data fetcher — called by Node.js server as a child process.
Usage:
  python3 fetcher.py quotes  "SYM1,SYM2,..."
  python3 fetcher.py history "SYM" "1y" "1d"
"""
import sys
import json
import io
import warnings
warnings.filterwarnings('ignore')

import yfinance as yf
import pandas as pd
import urllib.request
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

mode = sys.argv[1] if len(sys.argv) > 1 else 'quotes'

# ── Helpers ────────────────────────────────────────────────────────────────────

def safe(val):
    try:
        if val is None or (isinstance(val, float) and (val != val)):
            return None
        return val
    except Exception:
        return None

def df_to_rows(df, intraday=False):
    if hasattr(df.columns, 'levels'):
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
    rows = []
    for ts, row in df.iterrows():
        close_val = safe(row.get('Close') if 'Close' in row else row.get('close'))
        rows.append({
            'date':   ts.strftime('%m-%d %H:%M') if intraday else ts.strftime('%Y-%m-%d'),
            'open':   safe(row.get('Open')),
            'high':   safe(row.get('High')),
            'low':    safe(row.get('Low')),
            'close':  close_val,
            'volume': safe(row.get('Volume')),
        })
    return rows

def get_prev_close(t, fallback):
    """
    Return the true unadjusted previous close for a ticker.
    Uses 5-day daily history (auto_adjust=False).
    Key insight: if today's candle is already in the history (market is open),
    we need hist[-2]; if today's candle is missing (stock hasn't traded yet today
    or low-volume gap), we need hist[-1].
    """
    try:
        hist = t.history(period='5d', interval='1d', auto_adjust=False)
        if len(hist) == 0:
            return fallback
        last_date = hist.index[-1].date()  # index is tz-aware America/Santiago
        today = datetime.now(timezone.utc).astimezone().date()
        if last_date == today:
            # Today's bar is already in history → prev = second-to-last
            if len(hist) >= 2:
                return float(hist['Close'].iloc[-2])
        else:
            # Today's bar not yet in history → prev = last available close
            return float(hist['Close'].iloc[-1])
    except Exception:
        pass
    return fallback

def fetch_ipsa_stooq(period):
    """Fetch IPSA daily history from Stooq (only used for IPSA daily charts)."""
    period_days = {'1mo': 35, '3mo': 95, '6mo': 185, '1y': 370, '2y': 740}
    days = period_days.get(period, 370)
    end   = datetime.now()
    start = end - timedelta(days=days)
    d1 = start.strftime('%Y%m%d')
    d2 = end.strftime('%Y%m%d')
    url = f'https://stooq.com/q/d/l/?s=%5Eipsa&d1={d1}&d2={d2}&i=d'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        df = pd.read_csv(io.StringIO(resp.read().decode('utf-8')))
    if df.empty or 'Close' not in df.columns:
        return []
    df = df.sort_values('Date').reset_index(drop=True)
    rows = []
    for _, row in df.iterrows():
        rows.append({
            'date':   str(row['Date']),
            'open':   safe(float(row['Open']))   if pd.notna(row.get('Open'))   else None,
            'high':   safe(float(row['High']))   if pd.notna(row.get('High'))   else None,
            'low':    safe(float(row['Low']))    if pd.notna(row.get('Low'))    else None,
            'close':  safe(float(row['Close']))  if pd.notna(row.get('Close'))  else None,
            'volume': safe(float(row['Volume'])) if pd.notna(row.get('Volume')) else None,
        })
    return rows

def fetch_ipsa_stooq_range(start_str):
    """Fetch IPSA daily history from Stooq using an explicit start date (YYYY-MM-DD)."""
    d1  = start_str.replace('-', '')
    d2  = datetime.now().strftime('%Y%m%d')
    url = f'https://stooq.com/q/d/l/?s=%5Eipsa&d1={d1}&d2={d2}&i=d'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        df = pd.read_csv(io.StringIO(resp.read().decode('utf-8')))
    if df.empty or 'Close' not in df.columns:
        return []
    df = df.sort_values('Date').reset_index(drop=True)
    rows = []
    for _, row in df.iterrows():
        rows.append({
            'date':   str(row['Date']),
            'open':   safe(float(row['Open']))   if pd.notna(row.get('Open'))   else None,
            'high':   safe(float(row['High']))   if pd.notna(row.get('High'))   else None,
            'low':    safe(float(row['Low']))    if pd.notna(row.get('Low'))    else None,
            'close':  safe(float(row['Close']))  if pd.notna(row.get('Close'))  else None,
            'volume': safe(float(row['Volume'])) if pd.notna(row.get('Volume')) else None,
        })
    return rows

# ── Modes ──────────────────────────────────────────────────────────────────────

if mode == 'quotes':
    symbols = sys.argv[2].split(',') if len(sys.argv) > 2 else []

    def fetch_one(sym):
        try:
            t  = yf.Ticker(sym)
            fi = t.fast_info
            def g(attr):
                try: return safe(getattr(fi, attr))
                except: return None
            price = safe(fi.last_price)
            prev  = safe(fi.previous_close)

            # Use non-adjusted 5-day history to get the true previous close.
            # fast_info.previous_close (and t.info) can return dividend-adjusted
            # values for some Chilean stocks (ILC, BCI, LTM, CENCOMALLS, etc.)
            # which makes var% incorrect while the current price is fine.
            change     = None
            change_pct = None
            prev = get_prev_close(t, prev)

            if change is None and price is not None and prev is not None:
                change = round(price - prev, 4)
            if change_pct is None and price is not None and prev is not None and prev != 0:
                change_pct = round((price - prev) / prev * 100, 4)

            return sym, {
                'symbol': sym,
                'regularMarketPrice': price,
                'regularMarketChange': change,
                'regularMarketChangePercent': change_pct,
                'regularMarketPreviousClose': prev,
                'regularMarketOpen': g('open'),
                'regularMarketDayHigh': g('day_high'),
                'regularMarketDayLow': g('day_low'),
                'regularMarketVolume': g('volume'),
                'marketCap': g('market_cap'),
                'fiftyTwoWeekHigh': g('year_high'),
                'fiftyTwoWeekLow': g('year_low'),
                'currency': g('currency') or 'CLP',
                'shortName': sym,
                'regularMarketTime': None,
                'trailingPE': None,
                'dividendYield': None,
                'averageVolume': None,
            }
        except Exception:
            return sym, None

    result = {}
    with ThreadPoolExecutor(max_workers=16) as ex:
        for sym, data in ex.map(fetch_one, symbols):
            result[sym] = data
    print(json.dumps(result))

elif mode == 'history':
    sym      = sys.argv[2] if len(sys.argv) > 2 else ''
    period   = sys.argv[3] if len(sys.argv) > 3 else '1y'
    interval = sys.argv[4] if len(sys.argv) > 4 else '1d'
    intraday = interval in ('1m','2m','5m','15m','30m','60m','90m','1h')
    try:
        t  = yf.Ticker(sym)
        df = t.history(period=period, interval=interval, auto_adjust=True)
        if df.empty:
            df = t.history(period=period, interval=interval, auto_adjust=False)

        if len(df) < 5 and not intraday and sym.upper() == '^IPSA':
            sys.stderr.write(f'[fetcher] yfinance empty for {sym}, trying Stooq\n')
            rows = fetch_ipsa_stooq(period)
            if rows:
                sys.stderr.write(f'[fetcher] Stooq returned {len(rows)} rows for {sym}\n')
            print(json.dumps(rows))
        elif len(df) == 0:
            sys.stderr.write(f'[fetcher] empty history for {sym} period={period} interval={interval}\n')
            print(json.dumps([]))
        else:
            print(json.dumps(df_to_rows(df, intraday)))
    except Exception as e:
        sys.stderr.write(f'[fetcher] history error {sym}: {e}\n')
        print(json.dumps([]))

elif mode == 'quote_single':
    sym = sys.argv[2] if len(sys.argv) > 2 else ''
    try:
        t  = yf.Ticker(sym)
        fi = t.fast_info
        price = safe(fi.last_price)
        prev  = safe(fi.previous_close)

        change     = None
        change_pct = None
        prev = get_prev_close(t, prev)

        if change is None and price is not None and prev is not None:
            change = round(price - prev, 4)
        if change_pct is None and price is not None and prev is not None and prev != 0:
            change_pct = round((price - prev) / prev * 100, 4)

        def g(attr):
            try: return safe(getattr(fi, attr))
            except: return None
        print(json.dumps({
            'symbol': sym,
            'regularMarketPrice': price,
            'regularMarketChange': change,
            'regularMarketChangePercent': change_pct,
            'regularMarketPreviousClose': prev,
            'regularMarketOpen': g('open'),
            'regularMarketDayHigh': g('day_high'),
            'regularMarketDayLow': g('day_low'),
            'regularMarketVolume': g('volume'),
            'marketCap': g('market_cap'),
            'fiftyTwoWeekHigh': g('year_high'),
            'fiftyTwoWeekLow': g('year_low'),
            'currency': g('currency') or 'CLP',
            'shortName': sym,
            'regularMarketTime': None,
            'trailingPE': None,
            'dividendYield': None,
            'averageVolume': None,
        }))
    except Exception as e:
        import traceback; traceback.print_exc()
        print(json.dumps(None))

elif mode == 'fundamentals':
    sym = sys.argv[2] if len(sys.argv) > 2 else ''
    try:
        t    = yf.Ticker(sym)
        info = t.info
        fi   = t.fast_info

        def s(k):
            return safe(info.get(k))
        def g(attr):
            try: return safe(getattr(fi, attr))
            except: return None

        market_cap = g('market_cap')

        # If price currency != financial-statement currency, ratios that mix
        # market cap with balance-sheet numbers will be wrong (e.g. ECL.SN
        # has price in CLP but financials in USD → P/B off by ~1 000x).
        price_ccy = info.get('currency', 'CLP')
        fin_ccy   = info.get('financialCurrency', price_ccy)
        same_ccy  = (price_ccy == fin_ccy)

        # ── Fetch annual financial statements ────────────────────────────────
        try:
            inc = t.income_stmt
            bal = t.balance_sheet
            cf  = t.cashflow
        except Exception:
            inc = bal = cf = None

        def row(df, *keys):
            """Return most recent annual value for the first matching row name."""
            if df is None or df.empty:
                return None
            for k in keys:
                if k in df.index:
                    series = df.loc[k].dropna()
                    if len(series):
                        return safe(float(series.iloc[0]))
            return None

        def rat(num, den):
            if num is None or den is None or den == 0:
                return None
            return safe(num / den)

        # ── Income statement ─────────────────────────────────────────────────
        revenue      = row(inc, 'Total Revenue')
        gross_profit = row(inc, 'Gross Profit')
        op_income    = row(inc, 'Operating Income', 'EBIT')
        net_income   = row(inc, 'Net Income')
        ebitda_rep   = row(inc, 'EBITDA', 'Normalized EBITDA')

        # ── Balance sheet ────────────────────────────────────────────────────
        total_assets   = row(bal, 'Total Assets')
        total_equity   = row(bal, 'Stockholders Equity', 'Common Stock Equity')
        total_debt     = row(bal, 'Total Debt')
        current_assets = row(bal, 'Current Assets')
        current_liab   = row(bal, 'Current Liabilities')
        cash           = row(bal, 'Cash And Cash Equivalents',
                              'Cash Cash Equivalents And Short Term Investments')
        inventory      = row(bal, 'Inventory')

        # ── Cash flow ────────────────────────────────────────────────────────
        da = row(cf, 'Depreciation And Amortization',
                     'Depreciation Amortization Depletion',
                     'Reconciled Depreciation')

        # ── Derived values ───────────────────────────────────────────────────
        # EBITDA: reported first; fallback = EBIT + D&A
        ebitda = ebitda_rep
        if ebitda is None and op_income is not None and da is not None:
            ebitda = op_income + abs(da)

        # ── Currency conversion for mismatch stocks (e.g. ECL.SN: CLP price, USD financials) ──
        fx_rate = 1.0  # multiplier to convert fin_ccy → price_ccy
        if not same_ccy and fin_ccy == 'USD' and price_ccy == 'CLP':
            try:
                fx_rate = float(yf.Ticker('USDCLP=X').fast_info.last_price)
            except Exception:
                fx_rate = None

        # When we have a valid FX rate, convert all monetary statement values to CLP
        # so we can compute mixed ratios (P/B, EV/EBITDA, P/E) properly.
        if fx_rate and fx_rate != 1.0:
            def cvt(v):
                return v * fx_rate if v is not None else None
            revenue_c      = cvt(revenue)
            gross_profit_c = cvt(gross_profit)
            op_income_c    = cvt(op_income)
            net_income_c   = cvt(net_income)
            total_assets_c = cvt(total_assets)
            total_equity_c = cvt(total_equity)
            total_debt_c   = cvt(total_debt)
            current_assets_c = cvt(current_assets)
            current_liab_c = cvt(current_liab)
            cash_c         = cvt(cash)
            inventory_c    = cvt(inventory)
            ebitda_c       = cvt(ebitda)
            calc_same_ccy  = True  # now all values are in CLP
        else:
            revenue_c = revenue; gross_profit_c = gross_profit
            op_income_c = op_income; net_income_c = net_income
            total_assets_c = total_assets; total_equity_c = total_equity
            total_debt_c = total_debt; current_assets_c = current_assets
            current_liab_c = current_liab; cash_c = cash
            inventory_c = inventory; ebitda_c = ebitda
            calc_same_ccy = same_ccy

        # Enterprise Value
        ev = None
        if calc_same_ccy and market_cap is not None:
            ev = market_cap + (total_debt_c or 0) - (cash_c or 0)

        # ── Ratios from raw statements (no currency ambiguity) ────────────────
        gross_margin = rat(gross_profit_c, revenue_c)
        op_margin    = rat(op_income_c,    revenue_c)
        net_margin   = rat(net_income_c,   revenue_c)
        roa          = rat(net_income_c,   total_assets_c)
        roe          = rat(net_income_c,   total_equity_c)
        de_ratio     = rat(total_debt_c,   total_equity_c)
        curr_ratio   = rat(current_assets_c, current_liab_c)

        quick_num   = ((current_assets_c - inventory_c)
                       if current_assets_c is not None and inventory_c is not None
                       else current_assets_c)
        quick_ratio = rat(quick_num, current_liab_c)

        # ── Ratios that mix market cap + statements ──
        pb        = rat(market_cap, total_equity_c) if calc_same_ccy else None
        ev_ebitda = rat(ev, ebitda_c)               if calc_same_ccy else None
        pe        = (rat(market_cap, net_income_c)
                     if calc_same_ccy and net_income_c and net_income_c > 0
                     else None)

        # ── Risk metrics (Beta vs IPSA, Volatilidad anual, Sharpe) ──────────────
        risk_beta = None
        risk_vol  = None
        risk_sharpe = None
        try:
            hist_s = t.history(period='1y', interval='1d', auto_adjust=True)
            # yfinance returns only 1 row for ^IPSA daily — use Stooq fallback
            ipsa_rows = fetch_ipsa_stooq('1y')
            if len(hist_s) > 20 and len(ipsa_rows) > 20:
                rs = hist_s['Close'].pct_change().dropna()
                ipsa_dates  = [r['date'] for r in ipsa_rows]
                ipsa_closes = [r['close'] for r in ipsa_rows if r['close'] is not None]
                ipsa_s = pd.Series(
                    [r['close'] for r in ipsa_rows],
                    index=pd.to_datetime([r['date'] for r in ipsa_rows])
                ).dropna()
                ri = ipsa_s.pct_change().dropna()
                rs.index = rs.index.tz_localize(None) if rs.index.tz is not None else rs.index
                df_r = pd.concat([rs, ri], axis=1, join='inner').dropna()
                df_r.columns = ['stock', 'ipsa']
                if len(df_r) > 20:
                    cov_val  = float(df_r['stock'].cov(df_r['ipsa']))
                    var_ipsa = float(df_r['ipsa'].var())
                    risk_beta = safe(round(cov_val / var_ipsa, 3)) if var_ipsa != 0 else None
                    risk_vol  = safe(round(float(df_r['stock'].std()) * (252 ** 0.5) * 100, 2))
                    ann_ret   = ((1 + float(df_r['stock'].mean())) ** 252 - 1) * 100
                    risk_free = 5.0  # TPM proxy %
                    risk_sharpe = safe(round((ann_ret - risk_free) / risk_vol, 3)) if risk_vol else None
        except Exception:
            pass

        print(json.dumps({
            'symbol':              sym,
            'shortName':           info.get('shortName', ''),
            'longName':            info.get('longName', ''),
            'sector':              info.get('sector', ''),
            'industry':            info.get('industry', ''),
            'currency':            price_ccy,
            'marketCap':           market_cap,
            'enterpriseValue':     ev,
            'trailingPE':          pe,
            'forwardPE':           s('forwardPE'),
            'priceToBook':         pb,
            'enterpriseToEbitda':  ev_ebitda,
            'dividendYield':       s('dividendYield'),
            'dividendRate':        s('dividendRate'),
            'operatingMargins':    op_margin,
            'profitMargins':       net_margin,
            'grossMargins':        gross_margin,
            'returnOnEquity':      roe,
            'returnOnAssets':      roa,
            'debtToEquity':        de_ratio,
            'currentRatio':        curr_ratio,
            'quickRatio':          quick_ratio,
            'beta':                s('beta'),
            'fiftyTwoWeekHigh':    g('year_high'),
            'fiftyTwoWeekLow':     g('year_low'),
            'fiftyDayAverage':     s('fiftyDayAverage'),
            'twoHundredDayAverage': s('twoHundredDayAverage'),
            'averageVolume':       s('averageVolume'),
            'averageVolume10days': s('averageVolume10days'),
            'riskBeta':            risk_beta,
            'riskVolatility':      risk_vol,
            'riskSharpe':          risk_sharpe,
        }))
    except Exception as e:
        sys.stderr.write(f'[fetcher] fundamentals error {sym}: {e}\n')
        print(json.dumps(None))

elif mode == 'history_range':
    sym   = sys.argv[2] if len(sys.argv) > 2 else ''
    start = sys.argv[3] if len(sys.argv) > 3 else ''
    try:
        t  = yf.Ticker(sym)
        df = t.history(start=start, interval='1d', auto_adjust=True)
        if df.empty:
            df = t.history(start=start, interval='1d', auto_adjust=False)

        if len(df) < 5 and sym.upper() == '^IPSA':
            sys.stderr.write(f'[fetcher] yfinance sparse for {sym} range, trying Stooq\n')
            rows = fetch_ipsa_stooq_range(start)
            if rows:
                sys.stderr.write(f'[fetcher] Stooq returned {len(rows)} rows\n')
            print(json.dumps(rows))
        elif df.empty:
            sys.stderr.write(f'[fetcher] empty history_range for {sym} start={start}\n')
            print(json.dumps([]))
        else:
            print(json.dumps(df_to_rows(df, intraday=False)))
    except Exception as e:
        sys.stderr.write(f'[fetcher] history_range error {sym}: {e}\n')
        print(json.dumps([]))

elif mode == 'perf_batch':
    symbols_str = sys.argv[2] if len(sys.argv) > 2 else ''
    symbols = [s.strip() for s in symbols_str.split(',') if s.strip()]

    def fetch_perf(sym):
        try:
            df = yf.Ticker(sym).history(period='1mo', interval='1d', auto_adjust=False)
            df = df.dropna(subset=['Close'])
            if len(df) < 2:
                return sym, {'week': None, 'month': None}
            last        = float(df['Close'].iloc[-1])
            month_first = float(df['Close'].iloc[0])
            week_idx    = max(0, len(df) - 6)
            week_first  = float(df['Close'].iloc[week_idx])
            return sym, {
                'month': round((last - month_first) / month_first * 100, 2) if month_first else None,
                'week':  round((last - week_first)  / week_first  * 100, 2) if week_first  else None,
            }
        except Exception:
            return sym, {'week': None, 'month': None}

    result = {}
    with ThreadPoolExecutor(max_workers=16) as ex:
        for sym, data in ex.map(fetch_perf, symbols):
            result[sym] = data
    print(json.dumps(result))

