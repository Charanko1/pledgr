export function sumAtomicAmounts(items: Array<{ amountAtomic?: string | null }> | null | undefined) {
  return (items || []).reduce((sum, item) => {
    try { return sum + BigInt(String(item.amountAtomic || "0")); }
    catch { return sum; }
  }, 0n).toString();
}
