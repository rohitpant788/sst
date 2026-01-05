function calculateCAGR(initial: number, final: number, days: number): number {
    const years = days / 365.25;
    if (years <= 0 || initial <= 0) return 0;
    return (Math.pow(final / initial, 1 / years) - 1) * 100;
}

console.log("--- CAGR Verification ---");

// Case 1: 1 Year, 10% Return
// Initial: 100, Final: 110, Days: 365.25
const res1 = calculateCAGR(100, 110, 365.25);
console.log(`Test 1 (1yr, 10%): Expected ~10.0%, Got ${res1.toFixed(2)}% ${Math.abs(res1 - 10) < 0.1 ? "PASS" : "FAIL"}`);

// Case 2: 2 Years, 21% Return (1.1 * 1.1 = 1.21)
// Initial: 100, Final: 121, Days: 365.25 * 2
const res2 = calculateCAGR(100, 121, 365.25 * 2);
console.log(`Test 2 (2yr, 21%): Expected ~10.0%, Got ${res2.toFixed(2)}% ${Math.abs(res2 - 10) < 0.1 ? "PASS" : "FAIL"}`);

// Case 3: 3 Years, 33.1% Return (1.1^3 = 1.331)
const res3 = calculateCAGR(100, 133.1, 365.25 * 3);
console.log(`Test 3 (3yr, 33.1%): Expected ~10.0%, Got ${res3.toFixed(2)}% ${Math.abs(res3 - 10) < 0.1 ? "PASS" : "FAIL"}`);

// Case 4: 0.5 Years, 5% Return 
// (1.05)^(1/0.5) = 1.05^2 = 1.1025 -> 10.25% Annualized
const res4 = calculateCAGR(100, 105, 365.25 * 0.5);
console.log(`Test 4 (0.5yr, 5% abs): Expected ~10.25%, Got ${res4.toFixed(2)}% ${Math.abs(res4 - 10.25) < 0.1 ? "PASS" : "FAIL"}`);
