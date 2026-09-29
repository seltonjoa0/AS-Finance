# Aflora — gestão financeira compartilhada

Aflora é uma aplicação web mobile-first para organizar a vida financeira de duas ou mais pessoas em espaços isolados. A fase atual inclui autenticação, convites de membros, troca de espaço, contas, categorias, movimentações e transferências.

O acompanhamento por feature, com situação, entregas e próxima etapa, fica em [`docs/DEVELOPMENT_STATUS.md`](docs/DEVELOPMENT_STATUS.md).

## Stack

- Next.js 16, React 19 e TypeScript 6
- Tailwind CSS 4
- Neon PostgreSQL com conexão pooled e TLS
- Prisma ORM 7 com adapter `pg`
- Zod, Argon2id e Vitest

## Executar localmente com Neon

Requisitos: Node.js 24.11+ e um projeto no Neon.

```powershell
npm install
Copy-Item .env.example .env
npm run db:generate
npm run db:deploy
npm run dev
```

Preencha `DATABASE_URL` no `.env` com a connection string pooled do Neon (host contendo `-pooler`) e TLS habilitado. O runtime eleva `sslmode=require` para `sslmode=verify-full`, mantendo a verificação de certificado explícita. O arquivo `.env` é ignorado pelo Git e nunca deve ser versionado.

### Variáveis

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | sim | Conexão pooled usada pela aplicação |
| `DIRECT_URL` | não | Conexão direta preferida pela CLI do Prisma; sem ela, a CLI usa `DATABASE_URL` |
| `SHADOW_DATABASE_URL` | não | Shadow database ao criar migrations em uma branch de desenvolvimento |
| `SESSION_TTL_DAYS` | não | Duração máxima da sessão; padrão 30 dias |
| `AUTH_RATE_LIMIT_MAX` | não | Tentativas de autenticação por janela; padrão 8 |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | não | Janela do rate limiter; padrão 900 segundos |

O pool da aplicação mantém no máximo cinco conexões por instância. O Neon faz o pooling externo; isso evita que cada processo local ou serverless abra conexões em excesso.

## Banco e migrations

```powershell
npm run db:status    # consulta o estado no Neon
npm run db:deploy    # aplica migrations versionadas
npm run db:generate  # regenera o Prisma Client
```

Use `npm run db:migrate` somente em uma branch de desenvolvimento do Neon, de preferência com `DIRECT_URL` e `SHADOW_DATABASE_URL`. Em produção, use apenas `db:deploy`.

As migrations atuais são:

- `initial_foundation`: usuários, espaços, membros e sessões;
- `finance_core`: contas, categorias, movimentações e divisão de responsabilidade.
- `space_invitations`: convites opacos, expiração, aceite e rastreabilidade.
- `invitation_guards`: integridade do aceite e apenas um convite ativo por e-mail/espaço.
- `account_transfers`: transferências internas entre contas sem duplicar receitas ou despesas.
- `transfer_tenant_integrity`: vínculo composto das contas ao espaço e precisão de centavos no Neon.

Valores monetários ficam em `DECIMAL(19,4)` e entram no domínio como centavos inteiros, sem cálculos em ponto flutuante. Datas de competência e vencimento são datas civis (`DATE`); instantes técnicos usam `TIMESTAMPTZ`.

## Funcionalidades atuais

- cadastro, login, logout e restauração de sessão;
- criação e configuração do espaço financeiro;
- convites pessoais com validade de sete dias, armazenados somente como hash;
- entrada de MEMBER com validação do e-mail convidado;
- troca segura entre os espaços dos quais o usuário participa;
- contas individuais ou compartilhadas e saldo inicial;
- categorias de receita e despesa;
- receitas e despesas pagas ou pendentes;
- registro separado de quem pagou e de quem é responsável;
- divisão individual, igualitária, percentual ou por valores personalizados, sempre fechando os centavos sem perda;
- transferências entre contas, refletidas nos saldos individuais sem alterar o saldo consolidado;
- dashboard com saldo, totais mensais, compromissos e registros recentes;
- filtros básicos de movimentações.

Todas as consultas financeiras partem do contexto autenticado. IDs vindos do formulário são novamente filtrados por `financial_space_id`, associação ativa e soft delete antes de qualquer escrita. Nas transferências, chaves estrangeiras compostas também impedem no banco que uma conta de outro espaço seja vinculada por escrita direta.

## Arquitetura

```text
src/
├── app/                    rotas, páginas e layouts
├── components/finance/     formulários financeiros interativos
├── components/layout/      navegação desktop e mobile
├── features/auth/          autenticação
├── features/invitations/   tokens, políticas e aceite de convites
├── features/spaces/        espaços e autorização
├── features/finance/       regras, consultas, schemas e Server Actions
├── lib/auth/               sessão e contexto autenticado
├── lib/db/                 cliente Neon/Prisma
└── generated/prisma/       client gerado, não versionado

prisma/
├── migrations/             histórico SQL
└── schema.prisma           modelo relacional
```

## Segurança

- senhas com Argon2id e tokens de sessão opacos com hash SHA-256;
- cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- validação Zod no servidor e limite de 64 KB para Server Actions;
- autenticação e autorização refeitas dentro de cada operação;
- CSP, HSTS, proteção contra framing e políticas restritivas de navegador;
- nenhuma credencial ou connection string é registrada pela aplicação.

O rate limiter atual é local ao processo e atende uma instância inicial. Antes de escalar horizontalmente, ele deve usar um armazenamento compartilhado.

## Qualidade

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Os testes cobrem autenticação, sessões, autorização de espaços, proxy, tokens e estados de convites, redirecionamentos seguros, precisão monetária, transferências e divisões iguais, percentuais e personalizadas.

## Fora do escopo desta fase

Cartões, faturas, parcelas, divisão proporcional à renda, dívidas, orçamentos, metas e relatórios avançados permanecem para fases posteriores. O modelo de `transaction_splits` já preserva a separação entre pagador e responsável para essa evolução.
