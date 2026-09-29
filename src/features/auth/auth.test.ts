import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/features/auth/schemas";
import { hashPassword, verifyPassword } from "@/lib/security/password";

describe("cadastro", () => {
  it("valida os dados e normaliza o e-mail", () => {
    const result = registerSchema.safeParse({
      name: "  Ana Silva  ",
      email: "  ANA@EXEMPLO.COM ",
      password: "senha-segura-123",
      passwordConfirmation: "senha-segura-123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        name: "Ana Silva",
        email: "ana@exemplo.com",
      });
    }
  });

  it("rejeita confirmação de senha diferente", () => {
    const result = registerSchema.safeParse({
      name: "Ana Silva",
      email: "ana@exemplo.com",
      password: "senha-segura-123",
      passwordConfirmation: "outra-senha-123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["passwordConfirmation"]);
    }
  });
});

describe("login", () => {
  it("aceita credenciais bem formadas", () => {
    expect(
      loginSchema.safeParse({
        email: "ana@exemplo.com",
        password: "senha-segura-123",
      }).success,
    ).toBe(true);
  });

  it("confere a senha contra um hash Argon2id", async () => {
    const hash = await hashPassword("senha-segura-123");

    expect(hash).toContain("$argon2id$");
    await expect(verifyPassword(hash, "senha-segura-123")).resolves.toBe(true);
    await expect(verifyPassword(hash, "senha-incorreta")).resolves.toBe(false);
  });
});
