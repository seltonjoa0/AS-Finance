# Controle de desenvolvimento

Este documento é atualizado ao término de cada feature. Ele registra o que foi entregue e define a próxima etapa de desenvolvimento.

## Feature concluída — Transferências entre contas

| Área | Situação | Entregue |
| --- | --- | --- |
| Modelagem | Concluída | Entidade `AccountTransfer` separada de receitas e despesas, com origem, destino, valor, data, autor e soft delete. |
| Banco Neon | Concluída | Migrations aplicadas com constraints para valor positivo, precisão em centavos, contas distintas e vínculo das duas contas ao mesmo espaço. |
| Segurança | Concluída | Origem e destino são revalidados pelo espaço autenticado e protegidos também por chaves estrangeiras compostas no banco. |
| Regra financeira | Concluída | Transferências alteram os saldos das contas, mas não afetam receitas, despesas ou saldo consolidado. |
| Formulário | Concluída | Cadastro responsivo com contas identificadas por tipo/titular, valor, data sem agendamento futuro, descrição e observações. |
| Histórico | Concluída | Transferências aparecem com origem, destino, titular, observações, filtro próprio e ordenação junto das demais movimentações. |
| Dashboard | Concluída | Transferências aparecem entre os registros recentes sem alterar os indicadores de receita e despesa. |
| Contas | Concluída | Saldos consideram entradas e saídas por uma única agregação líquida e consistente no banco. |
| Acessibilidade | Concluída | Foco visível, contraste AA, erros associados aos campos e filtro ativo anunciado por leitor de tela. |
| Validação | Concluída | Testes de valor, data presente/passada, contas distintas e cálculo de saldo, além do fluxo real desktop/mobile no Neon. |
| Documentação | Concluída | README e este controle atualizados com a nova capacidade. |

## Feature concluída — Divisão proporcional à renda

| Área | Situação | Entregue |
| --- | --- | --- |
| Modelagem de renda | Concluída | Entidade `MemberIncome` mantida como histórico append-only pela aplicação, por membro e data de vigência, preservando todas as configurações anteriores. |
| Banco Neon | Concluída | Migrations aplicadas com renda não negativa, precisão em centavos, unicidade por vigência e chaves compostas que mantêm rendas e snapshots de rateio no mesmo espaço. |
| Cálculo proporcional | Concluída | Pesos e percentuais calculados somente com inteiros; o algoritmo do maior resto fecha exatamente 100% e o total em centavos. |
| Rateio | Concluída | Método `INCOME_BASED` habilitado apenas para despesas, usando a renda vigente na data de competência. |
| Rastreabilidade | Concluída | Cada lançamento guarda percentuais e valores calculados para todos os membros, inclusive participações de 0%. |
| Consistência histórica | Concluída | Lançamentos retroativos usam quem participava do espaço na competência; rendas e nomes de membros revogados continuam visíveis no histórico. |
| Interface | Concluída | Configuração em lote nas configurações, histórico de vigências, estados de ausência/zero e prévia reativa no lançamento. |
| Permissões | Concluída | Somente OWNER altera rendas; todos os IDs são revalidados contra o espaço autenticado e o servidor ignora cálculos enviados pelo cliente. |
| Acessibilidade | Concluída | Grupos descritos, erros associados, região de prévia anunciada e alvos de ação adequados ao mobile; a validação foi manual, sem teste automatizado de acessibilidade nesta etapa. |
| Validação | Concluída | Testes automatizados, typecheck e lint aprovados; casos de renda zero, mudança de vigência, maior resto, fechamento exato de percentuais/centavos e centavo indivisível cobertos. |
| Documentação | Concluída | README e este controle atualizados com a capacidade e a migration nova. |

## Feature concluída — Receitas e despesas recorrentes

| Área | Situação | Entregue |
| --- | --- | --- |
| Modelagem | Concluída | Regras mensais com valor, conta, categoria, pagador, rateio, dia-base, início, término opcional, próxima ocorrência e estados ativa, pausada ou encerrada. |
| Banco Neon | Concluída | Migration com snapshots de divisão, vínculos compostos ao espaço e chave única por regra e competência para impedir ocorrências duplicadas. |
| Calendário | Concluída | Dia-base preservado; meses curtos usam o último dia disponível sem deslocar os meses seguintes, inclusive em anos bissextos. |
| Geração | Concluída | Previsões pendentes materializadas até seis meses à frente por upsert idempotente, com atualização manual do horizonte. |
| Regras financeiras | Concluída | Cada ocorrência reutiliza conta, categoria, pagador e método de divisão; o rateio proporcional usa a renda vigente em cada competência. |
| Ciclo de vida | Concluída | Pausa retira previsões futuras pendentes, retomada as restaura sem duplicidade e encerramento preserva o histórico já ocorrido. |
| Segurança | Concluída | Conta, categoria, pagador, membros, regra e ocorrências são revalidados no espaço autenticado, com integridade multi-tenant também no banco. |
| Interface | Concluída | Página responsiva para criar, listar, pausar, retomar, encerrar e atualizar recorrências, integrada à navegação e identificada no histórico de movimentações. |
| Validação | Concluída | Testes de schema, domínio, materialização, idempotência, isolamento por espaço e ciclo de vida, além de typecheck, lint e build. |
| Documentação | Concluída | README e este controle atualizados com a capacidade e a migration nova. |

## Feature concluída — Cartões de crédito e faturas

| Área | Situação | Entregue |
| --- | --- | --- |
| Modelagem | Concluída | Cartão vinculado a uma conta contábil interna individual, com banco, titular, limite, fechamento, vencimento e soft delete. |
| Banco Neon | Concluída | Migration com faturas `OPEN`, `CLOSED` e `PAID`, vínculos compostos ao espaço e invariantes para conta, compra e pagamento. |
| Ciclos | Concluída | Compras entram automaticamente na fatura correta; dias inexistentes usam o último dia do mês e o vencimento permanece posterior ao fechamento. |
| Regra financeira | Concluída | A compra é registrada uma única vez como despesa; pagar a fatura cria somente uma transferência integral da conta bancária para o cartão. |
| Faturas | Concluída | Fechamento liberado apenas na data prevista, pagamento somente após fechamento e estados protegidos contra regressão ou alteração posterior. |
| Limites | Concluída | Limite utilizado, disponível e excedido calculados em centavos pelo saldo contábil do cartão, considerando compras e pagamentos. |
| Rateios | Concluída | Compras aceitam responsabilidade individual, igualitária, percentual, personalizada ou proporcional à renda vigente, inclusive no histórico. |
| Interface | Concluída | Página mobile-first com cadastro, resumo de limites, faturas, lista de compras, fechamento e pagamento, integrada à navegação e ao histórico. |
| Segurança | Concluída | Cartão, categoria, membros, fatura e conta pagadora são revalidados no espaço; compras e pagamentos de faturas ficam protegidos também no banco. |
| Concorrência | Concluída | Fatura única por ciclo, pagamento único por fatura e repetição concorrente tratada de forma idempotente. |
| Validação | Concluída | Testes de schema, calendário, limite, actions, isolamento, fechamento e pagamento sem despesa duplicada, além de typecheck, lint e build. |
| Documentação | Concluída | README e este controle registram a regra contábil do cartão e a nova migration. |

## Próxima etapa — Compras parceladas

| Área | Situação | Planejado |
| --- | --- | --- |
| Modelagem | Planejada | Criar compra parcelada e parcelas imutáveis, preservando valor total, quantidade, número atual e cartão. |
| Calendário | Planejada | Distribuir cada parcela nas faturas mensais corretas, inclusive em meses curtos, sem duplicidade. |
| Regra financeira | Planejada | Reconhecer a despesa por parcela na competência correspondente e manter o pagamento da fatura como transferência. |
| Responsabilidade | Planejada | Reaproveitar pagador, categoria e snapshots dos cinco métodos de divisão em todas as parcelas. |
| Interface | Planejada | Cadastro simples, visão de parcelas pagas/futuras, saldo restante e quantidade de parcelas restantes. |
| Segurança e testes | Planejada | Garantir isolamento por espaço, fechamento exato em centavos, idempotência e integração com faturas já fechadas. |

Depois de compras parceladas, a sequência prevista é: dívidas e empréstimos, planejamento mensal e orçamentos.
