import { z } from "zod";

export const financialSpaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(100, "O nome deve ter no máximo 100 caracteres."),
});
