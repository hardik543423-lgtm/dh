// Utils/brokerage.js

/**
 * Calculate P&L and brokerage for a trade.
 *
 * @param {Object} params
 * @param {"BUY"|"SELL"} params.side               - Trade side
 * @param {number} params.avgPrice                 - Entry average price
 * @param {number} params.ltp                      - Current / exit price
 * @param {number} params.qty                      - Quantity
 * @param {number} [params.brokeragePercentPerSide=0.01] - Brokerage % per side (e.g. 0.01 for 0.01%)
 * @param {"entry-only"|"round-trip"} [params.mode="entry-only"]
 *        "entry-only"  → sirf executed entry leg par brokerage
 *        "round-trip"  → entry + exit dono side brokerage
 *
 * @returns {{
 *   entryValue: number,
 *   currentValue: number,
 *   brokerageEntry: number,
 *   brokerageExit: number,
 *   totalBrokerage: number,
 *   grossPnl: number,
 *   netPnl: number,
 *   pct: number
 * }}
 */
export function calculatePnLAndBrokerage({
  side,
  avgPrice,
  ltp,
  qty,
  brokeragePercentPerSide = 0.01,
  mode = "entry-only",
  symbol = "",
}) {
  const safeSide = String(side || "BUY").toUpperCase();
  const quantity = Number(qty || 0);
  const entry = Number(avgPrice || 0);
  const last = Number(ltp || 0);

  const entryValue = entry * quantity;
  const currentValue = last * quantity;

  // Check for CE/PE option stocks
  const symUpper = String(symbol).toUpperCase();
  const isOption = symUpper.endsWith("CE") || symUpper.endsWith("PE") || symUpper.endsWith("CALL") || symUpper.endsWith("PUT");

  let brokerageEntry = 0;
  let brokerageExit = 0;

  if (isOption) {
    brokerageEntry = 20;
    brokerageExit = mode === "round-trip" ? 20 : 0;
  } else {
    const rate = Number(brokeragePercentPerSide) / 100;
    brokerageEntry = entryValue * rate;
    brokerageExit = mode === "round-trip" ? currentValue * rate : 0;
  }
  const totalBrokerage = brokerageEntry + brokerageExit;

  // Gross P&L (brokerage ke bina)
  const diffPerShare =
    safeSide === "BUY" ? last - entry : entry - last;

  const grossPnl = diffPerShare * quantity;

  // Net P&L (brokerage ke baad)
  const netPnl = grossPnl - totalBrokerage;

  // % return (entry capital ke base par)
  const pct = entryValue ? (netPnl / entryValue) * 100 : 0;

  return {
    entryValue,
    currentValue,
    brokerageEntry,
    brokerageExit,
    totalBrokerage,
    grossPnl,
    netPnl,
    pct,
  };
}

/**
 * Simple helper: sirf brokerage amount nikalne ke liye,
 * agar tumhare paas already turnover (value) hai.
 *
 * @param {number} turnover                - e.g. price * qty
 * @param {number} [brokeragePercent=0.01] - percent, e.g. 0.01 for 0.01%
 * @returns {number}                       - brokerage amount
 */
export function calculateBrokerage(turnover, brokeragePercent = 0.01) {
  const value = Number(turnover || 0);
  const rate = Number(brokeragePercent) / 100;
  return value * rate;
}






// Utils/calculateBrokerage.jsx

/**
 * EXIT ke time full trade ka brokerage + P&L calculate karega
 *  - side: "BUY" ya "SELL" (original entry side)
 *  - avgPrice: entry average price
 *  - exitPrice: jis price pe tum EXIT kar rahi ho (closed_ltp)
 *  - qty: total quantity
 *  - brokeragePercentPerSide: har side ka %, e.g. 0.01 => 0.01%
 *
 * Returns:
 *  {
 *    entryValue,
 *    exitValue,
 *    brokerageEntry,
 *    brokerageExit,
 *    totalBrokerage,
 *    grossPnl,
 *    netPnl,
 *    pct
 *  }
 */
export function calculateExitBrokerageAndPnL({
  side,
  avgPrice,
  exitPrice,
  qty,
  brokeragePercentPerSide = 0.01, // 0.01%
  symbol = "",
}) {
  const safeSide = String(side || "BUY").toUpperCase();
  const quantity = Number(qty || 0);
  const entry = Number(avgPrice || 0);
  const exit = Number(exitPrice || 0);

  const entryValue = entry * quantity;
  const exitValue = exit * quantity;

  // Check for CE/PE option stocks
  const symUpper = String(symbol).toUpperCase();
  const isOption = symUpper.endsWith("CE") || symUpper.endsWith("PE") || symUpper.endsWith("CALL") || symUpper.endsWith("PUT");

  let brokerageEntry = 0;
  let brokerageExit = 0;

  if (isOption) {
    brokerageEntry = 20;
    brokerageExit = 20;
  } else {
    const rate = Number(brokeragePercentPerSide) / 100;
    brokerageEntry = entryValue * rate;
    brokerageExit = exitValue * rate;
  }
  const totalBrokerage = brokerageEntry + brokerageExit;

  // Gross P&L (brokerage ke bina)
  const diffPerShare =
    safeSide === "BUY" ? exit - entry : entry - exit;

  const grossPnl = diffPerShare * quantity;

  // Net P&L (brokerage ke baad)
  const netPnl = grossPnl - totalBrokerage;

  // % return (entry capital ke base par)
  const pct = entryValue ? (netPnl / entryValue) * 100 : 0;

  return {
    entryValue,
    exitValue,
    brokerageEntry,
    brokerageExit,
    totalBrokerage,
    grossPnl,
    netPnl,
    pct,
  };
}

export function formatTradingSymbol(symbol) {
  if (!symbol) return "";
  
  // Normalise by removing all spaces and pluses
  let clean = String(symbol).replace(/[\+\s]/g, "").toUpperCase();

  // 1. Match option type from the end (CE|PE|CALL|PUT)
  const optTypeMatch = clean.match(/(CE|PE|CALL|PUT)$/i);
  if (optTypeMatch) {
    const optType = optTypeMatch[1];
    const withoutType = clean.slice(0, -optTypeMatch[0].length);

    // 2. Separate name from the digits/dates
    // Since symbol names do not end with digits that look like date,
    // we match everything before the first digit.
    const nameMatch = withoutType.match(/^[^0-9]+/);
    if (nameMatch) {
      const namePart = nameMatch[0];
      const rest = withoutType.slice(namePart.length);

      // 3. Match the date part at the beginning of rest
      // Date formats:
      // - 2 digits + 3 letters (e.g. 26AUG)
      // - 2 digits + 1 char [1-9OND] + 2 digits (e.g. 26818)
      const dateRegexes = [
        /^(\d{2}[A-Z]{3})/i,      // e.g. 26AUG
        /^(\d{2}[1-9OND]\d{2})/i  // e.g. 26818
      ];

      let datePart = "";
      let strikePart = "";

      for (const regex of dateRegexes) {
        const match = rest.match(regex);
        if (match) {
          datePart = match[1];
          strikePart = rest.slice(datePart.length);
          break;
        }
      }

      if (datePart && strikePart) {
        return `${namePart} ${datePart} ${strikePart} ${optType}`;
      }
    }
  }

  // Future regex fallback
  const futureRegex = /^([A-Z\&0-9\-\_]+?)\s*(\d{2}[A-Z]{3}\d{2}|\d{2}[A-Z]{3}|\d{2}[1-9OND]\d{2})\s*(FUT|FUTURE|FUTURES)$/i;
  const futMatch = clean.match(futureRegex);
  if (futMatch) {
    return `${futMatch[1]} ${futMatch[2]} ${futMatch[3]}`;
  }

  // If no patterns match, return with spaces if they were originally there
  return String(symbol).replace(/\+/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * New corrected format trading symbol function.
 * Splits: [NAME] + [DATE] + [STRIKE] + [CE/PE]
 * Enforces date extraction first to prevent digits leaking into strike price.
 */
export function formatTradingSymbolNew(symbol) {
  return formatTradingSymbol(symbol);
}
