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

## Próxima etapa — Divisão proporcional à renda

| Área | Situação | Planejado |
| --- | --- | --- |
| Modelagem de renda | Planejada | Registrar a renda de cada membro com vigência temporal, sem sobrescrever o histórico. |
| Cálculo proporcional | Planejada | Calcular a participação de cada membro sobre a renda total usando precisão decimal. |
| Rateio | Planejada | Habilitar o método `INCOME_BASED` nas despesas compartilhadas. |
| Rastreabilidade | Planejada | Preservar no lançamento os percentuais e valores efetivamente utilizados no cálculo. |
| Interface | Planejada | Exibir prévia do rateio e orientar quando algum membro não possuir renda configurada. |
| Segurança | Planejada | Validar que rendas e membros pertençam ao espaço financeiro ativo. |
| Testes | Planejada | Cobrir renda zero, mudanças de vigência, arredondamento e fechamento exato dos centavos. |

Após essa etapa, a sequência prevista é: recorrências, cartões e faturas, compras parceladas, dívidas, planejamento e orçamentos.
