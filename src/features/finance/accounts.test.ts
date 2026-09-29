import { describe, expect, it } from "vitest";

import { formatAccountLabel } from "@/features/finance/accounts";

describe("account labels", () => {
  it("identifica uma conta compartilhada pelo nome e tipo", () => {
    expect(
      formatAccountLabel({
        name: "Reserva",
        type: "SAVINGS",
        ownership: "SHARED",
      }),
    ).toBe("Reserva · Poupança · Compartilhada");
  });

  it("identifica o titular de uma conta individual", () => {
    expect(
      formatAccountLabel({
        name: "Nubank",
        type: "CHECKING",
        ownership: "INDIVIDUAL",
        holderName: "Ana",
      }),
    ).toBe("Nubank · Conta corrente · Ana");
  });
});
