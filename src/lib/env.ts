import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => /^postgres(?:ql)?:\/\//.test(value), {
      message: "DATABASE_URL deve usar o protocolo postgres ou postgresql.",
    }),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(8),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(86_400)
    .default(900),
});

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      "Configuração do servidor inválida. Verifique DATABASE_URL e as variáveis de ambiente.",
    );
  }

  return parsed.data;
}
