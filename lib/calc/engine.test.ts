import { describe, expect, it } from "vitest";
import { computeAnnualPayouts, computeMonthlyAccruals, effectiveBrackets } from "@/lib/calc/engine";
import type { Contract, RevenueLine } from "@/lib/types";

function contract(overrides: Partial<Contract>): Contract {
  return {
    id: "c1",
    contractNumber: "C-001",
    name: "Test",
    flatRatePct: 10,
    royaltyModel: "flat",
    tierAccumulator: "contract",
    tierReset: "year",
    brackets: [],
    productIds: ["p1"],
    authors: [],
    startDate: "2026-01-01",
    endDate: null,
    status: "active",
    ...overrides,
  };
}

describe("effectiveBrackets", () => {
  it("synthesiseert één schijf voor een vast contract", () => {
    const b = effectiveBrackets(contract({ flatRatePct: 12.5 }));
    expect(b).toEqual([{ lowerUnits: 0, upperUnits: null, ratePct: 12.5 }]);
  });
});

describe("marginale staffel-accrual", () => {
  // Staffel: 0-5000 @10%, 5000-10000 @12%, >10000 @14%. Prijs €10/exemplaar.
  const c = contract({
    royaltyModel: "tiered",
    brackets: [
      { lowerUnits: 0, upperUnits: 5000, ratePct: 10 },
      { lowerUnits: 5000, upperUnits: 10000, ratePct: 12 },
      { lowerUnits: 10000, upperUnits: null, ratePct: 14 },
    ],
  });
  const rev: RevenueLine[] = [
    { productId: "p1", periode: "2026-01", omzet: 30000, aantal: 3000 },
    { productId: "p1", periode: "2026-02", omzet: 40000, aantal: 4000 },
    { productId: "p1", periode: "2026-03", omzet: 50000, aantal: 5000 },
  ];

  it("verdeelt elke maand marginaal over de schijven", () => {
    const acc = computeMonthlyAccruals(c, rev);
    const byPeriode = Object.fromEntries(acc.map((a) => [a.periode, a.royaltyCost]));
    expect(byPeriode["2026-01"]).toBeCloseTo(3000, 6); // volledig @10%
    expect(byPeriode["2026-02"]).toBeCloseTo(4400, 6); // 2000@10% + 2400@12%
    expect(byPeriode["2026-03"]).toBeCloseTo(6400, 6); // 3600@12% + 2800@14%
  });

  it("jaartotaal komt overeen met per-exemplaar-marginaal", () => {
    const acc = computeMonthlyAccruals(c, rev);
    const total = acc.reduce((s, a) => s + a.royaltyCost, 0);
    // 5000@10%*10 + 5000@12%*10 + 2000@14%*10 = 5000 + 6000 + 2800
    expect(total).toBeCloseTo(13800, 6);
  });

  it("verdeelt de contract-royalty over auteurs met voorschot-recoupment", () => {
    const c2 = { ...c, authors: [
      { authorId: "a", share: 60, advance: 5000, advanceYear: 2026 },
      { authorId: "b", share: 40, advance: 0, advanceYear: 2026 },
    ] };
    const acc = computeMonthlyAccruals(c2, rev);
    const pay = computeAnnualPayouts(c2, acc);
    const a = pay.find((p) => p.authorId === "a" && p.boekjaar === 2026)!;
    const b = pay.find((p) => p.authorId === "b" && p.boekjaar === 2026)!;
    // A: 13800*60% = 8280 verdiend, 5000 voorschot verrekend -> 3280
    expect(a.earnedAuthor).toBeCloseTo(8280, 6);
    expect(a.recouped).toBeCloseTo(5000, 6);
    expect(a.payout).toBeCloseTo(3280, 6);
    // B: 13800*40% = 5520, geen voorschot -> 5520
    expect(b.payout).toBeCloseTo(5520, 6);
  });
});

describe("voorschot carry-forward over meerdere jaren", () => {
  const c = contract({
    flatRatePct: 10,
    authors: [{ authorId: "a", share: 100, advance: 10000, advanceYear: 2026 }],
  });
  const rev: RevenueLine[] = [
    { productId: "p1", periode: "2026-06", omzet: 80000, aantal: 8000 }, // earned 8000
    { productId: "p1", periode: "2027-06", omzet: 120000, aantal: 12000 }, // earned 12000
  ];

  it("2026 betaalt 0 uit en schuift 2000 voorschot door; 2027 betaalt 10000", () => {
    const acc = computeMonthlyAccruals(c, rev);
    const pay = computeAnnualPayouts(c, acc);
    const y26 = pay.find((p) => p.boekjaar === 2026)!;
    const y27 = pay.find((p) => p.boekjaar === 2027)!;
    expect(y26.payout).toBeCloseTo(0, 6);
    expect(y26.closingBalance).toBeCloseTo(2000, 6); // schuift door
    expect(y27.openingBalance).toBeCloseTo(2000, 6); // = closing vorig jaar
    expect(y27.payout).toBeCloseTo(10000, 6);
  });
});

describe("voorschot dat later opent", () => {
  it("verrekent alleen met verdiensten vanaf het voorschot-jaar, niet met eerdere jaren", () => {
    const c = contract({
      flatRatePct: 10,
      authors: [{ authorId: "a", share: 100, advance: 5000, advanceYear: 2026 }],
    });
    const rev: RevenueLine[] = [
      { productId: "p1", periode: "2024-06", omzet: 80000, aantal: 8000 }, // earned 8000
      { productId: "p1", periode: "2025-06", omzet: 80000, aantal: 8000 }, // earned 8000
      { productId: "p1", periode: "2026-06", omzet: 80000, aantal: 8000 }, // earned 8000
    ];
    const pay = computeAnnualPayouts(c, computeMonthlyAccruals(c, rev));
    expect(pay.find((p) => p.boekjaar === 2024)!.payout).toBeCloseTo(8000, 6); // niet verrekend
    expect(pay.find((p) => p.boekjaar === 2025)!.payout).toBeCloseTo(8000, 6); // niet verrekend
    const y26 = pay.find((p) => p.boekjaar === 2026)!;
    expect(y26.recouped).toBeCloseTo(5000, 6); // pas nu verrekend
    expect(y26.payout).toBeCloseTo(3000, 6);
  });
});

describe("nul-exemplaren met omzet (retour/credit)", () => {
  it("belast tegen de huidige tier i.p.v. te delen door nul", () => {
    const c = contract({ flatRatePct: 10 });
    const rev: RevenueLine[] = [{ productId: "p1", periode: "2026-01", omzet: 1000, aantal: 0 }];
    const acc = computeMonthlyAccruals(c, rev);
    expect(acc[0].royaltyCost).toBeCloseTo(100, 6);
  });
});
