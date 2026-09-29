type AccountLabelInput = {
  name: string;
  type: "CHECKING" | "SAVINGS" | "CASH" | "INVESTMENT" | "OTHER";
  ownership: "INDIVIDUAL" | "SHARED";
  holderName?: string | null;
};

const accountTypeLabels = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  CASH: "Dinheiro",
  INVESTMENT: "Investimento",
  OTHER: "Outra",
} as const;

export function formatAccountLabel(account: AccountLabelInput) {
  const owner =
    account.ownership === "SHARED"
      ? "Compartilhada"
      : (account.holderName ?? "Individual");

  return `${account.name} · ${accountTypeLabels[account.type]} · ${owner}`;
}
