export function getCurrencySymbol(currency: string): string {
  switch (currency) {
    case "USD":
      return "$";
    case "GBP":
      return "£";
    case "EUR":
      return "€";
    case "OTHER":
      return "";
    default:
      return "£"; // Default to GBP
  }
}

export function formatAmount(amount: number | string, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  const formatted = numAmount.toFixed(2);
  
  if (currency === "OTHER") {
    return formatted;
  }
  
  return `${symbol}${formatted}`;
}