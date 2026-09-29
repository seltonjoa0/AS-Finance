import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { proxy } from "../../proxy";

describe("proteção de rota", () => {
  it("redireciona visitantes sem cookie para o login", () => {
    const response = proxy(new NextRequest("http://localhost:3000/app"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?motivo=sessao",
    );
  });

  it("deixa a validação autoritativa seguir quando há cookie", () => {
    const request = new NextRequest("http://localhost:3000/app", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=opaque-token` },
    });

    expect(proxy(request).status).toBe(200);
  });
});
