import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .email("Informe um e-mail válido.")
  .max(254, "O e-mail é muito longo.")
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(10, "Use pelo menos 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(/[a-zA-Z]/, "Inclua ao menos uma letra.")
  .regex(/[0-9]/, "Inclua ao menos um número.");

const nextPath = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().max(500).optional(),
);

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Informe seu nome.")
      .max(100, "O nome deve ter no máximo 100 caracteres."),
    email,
    password,
    passwordConfirmation: z.string(),
    next: nextPath,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas não coincidem.",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha.").max(128),
  next: nextPath,
});
