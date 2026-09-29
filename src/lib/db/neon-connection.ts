export function secureNeonRuntimeUrl(connectionString: string) {
  const url = new URL(connectionString);

  if (url.hostname.endsWith(".neon.tech") && url.searchParams.get("sslmode") === "require") {
    // O pg 8 trata `require` como verificação completa, mas mudará essa semântica
    // na próxima major. Tornamos a intenção explícita sem alterar o `.env` do usuário.
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}
