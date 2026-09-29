import { z } from "zod";

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail da pessoa.")
    .email("Informe um e-mail válido.")
    .max(254, "O e-mail é muito longo.")
    .transform((value) => value.toLowerCase()),
});

export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Convite inválido.");

export const invitationIdSchema = z.string().uuid("Convite inválido.");
