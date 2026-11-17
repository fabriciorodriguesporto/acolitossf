# Acólitos São Francisco

## Persistência na nuvem (Vercel + Neon)

A página pública carrega o estado atual por `GET /api/state`. Alterações administrativas são enviadas por `PUT /api/state`; somente a função da Vercel acessa o banco. A senha e a conexão do banco não ficam no HTML. A autenticação usa uma sessão assinada em cookie `HttpOnly`.

### Banco de dados

Crie um banco PostgreSQL no Neon e copie a string de conexão (`DATABASE_URL`), de preferência a opção pooled. A aplicação cria a tabela e o registro inicial automaticamente na primeira chamada à API.

Esta é a estrutura criada:

```sql
CREATE TABLE IF NOT EXISTS acolitos_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  data JSONB NOT NULL,
  initialized BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`data` contém o estado completo da aplicação (`members`, `settings`, `masses` e `initialOrderApplied`). A tabela não precisa de acesso público: apenas as funções serverless usam a credencial PostgreSQL.

### Variáveis de ambiente da Vercel

Em **Project Settings → Environment Variables**, configure estas variáveis em todos os ambientes que usará (Production, Preview e Development):

| Nome | Valor |
| --- | --- |
| `DATABASE_URL` | String de conexão PostgreSQL do Neon |
| `ADMIN_EMAIL` | E-mail usado para entrar na área ADM |
| `ADMIN_PASSWORD` | Senha forte escolhida para a área ADM |
| `SESSION_SECRET` | Segredo aleatório com pelo menos 32 bytes, usado para assinar a sessão |

Gere `SESSION_SECRET` com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Não coloque essas credenciais em `index.html`, não use prefixos públicos como `NEXT_PUBLIC_` e não as envie ao Git.

### Publicação

1. Configure as quatro variáveis acima na Vercel.
2. Instale as dependências (`npm install`) e publique/republique o projeto.
3. Na primeira abertura, a API cria a tabela e o estado inicial; não é necessário inserir linhas manualmente.

Se houver dados antigos no `localStorage` deste navegador e o banco ainda não tiver recebido alterações, o primeiro login administrativo os migra para a nuvem. O armazenamento local só é removido depois que a gravação no banco confirma sucesso. A partir daí, os dados públicos vêm da API e as alterações administrativas são compartilhadas entre dispositivos.
