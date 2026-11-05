import { startSanctionExpirySweep } from "../../src/services/account-sanctions/sweep";

describe("startSanctionExpirySweep", () => {
  test("devuelve un intervalo que no mantiene vivo el proceso", () => {
    const timer = startSanctionExpirySweep();
    try {
      expect(timer.hasRef()).toBe(false);
    } finally {
      clearInterval(timer);
    }
  });
});
