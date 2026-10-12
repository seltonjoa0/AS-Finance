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

## Próxima etapa — Receitas e despesas recorrentes

| Área | Situação | Planejado |
| --- | --- | --- |
| Modelagem | Planejada | Criar regras de recorrência com frequência, início, término opcional, próxima competência e estado ativo. |
| Geração | Planejada | Materializar ocorrências de forma idempotente, sem duplicar lançamentos em reprocessamentos. |
| Regras financeiras | Planejada | Reaproveitar conta, categoria, status, pagador e método de divisão da regra original. |
| Interface | Planejada | Permitir criar, consultar, pausar e encerrar recorrências com clareza no mobile. |
| Segurança | Planejada | Revalidar todos os vínculos no espaço ativo e registrar autoria das alterações. |
| Testes | Planejada | Cobrir virada de mês, meses curtos, término, pausa e prevenção de duplicidade. |

Depois de recorrências, a sequência prevista é: cartões e faturas, compras parceladas, dívidas, planejamento e orçamentos.
