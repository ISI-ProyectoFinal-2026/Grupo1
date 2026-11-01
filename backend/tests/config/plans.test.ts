import { getPlanOffers, parsePlanPrice } from "../../src/config/plans";

describe("parsePlanPrice", () => {
  test("sin valor usa el precio por defecto", () => {
    expect(parsePlanPrice("PREMIUM_MONTHLY_PRICE_USD", undefined, 30)).toBe(30);
    expect(parsePlanPrice("PREMIUM_MONTHLY_PRICE_USD", "  ", 30)).toBe(30);
  });

  test("acepta un precio positivo con decimales", () => {
    expect(parsePlanPrice("PREMIUM_MONTHLY_PRICE_USD", "29.99", 30)).toBe(29.99);
  });

  test.each(["0", "-5", "abc", "10usd"])("rechaza el valor inválido %p", (raw) => {
    expect(() => parsePlanPrice("PREMIUM_MONTHLY_PRICE_USD", raw, 30)).toThrow(/PREMIUM_MONTHLY_PRICE_USD/);
  });
});

describe("getPlanOffers", () => {
  test("ofrece Premium mensual a USD 30 y anual a USD 300 por defecto", () => {
    expect(getPlanOffers({})).toEqual([
      { plan: "PREMIUM", period: "MONTHLY", months: 1, priceUsd: 30 },
      { plan: "PREMIUM", period: "ANNUAL", months: 12, priceUsd: 300 },
    ]);
  });

  test("toma los precios de las variables de entorno", () => {
    const offers = getPlanOffers({ PREMIUM_MONTHLY_PRICE_USD: "35", PREMIUM_ANNUAL_PRICE_USD: "350" });
    expect(offers.map((offer) => offer.priceUsd)).toEqual([35, 350]);
  });
});
