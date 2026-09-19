# Implantação completa na Cloudflare

## Topologia escolhida

Um único projeto Cloudflare entrega tudo que existe no MVP:

| Parte | Serviço |
|---|---|
| HTML, CSS, JavaScript, manifest e service worker | Workers Static Assets |
| API de salas | Cloudflare Worker |
| Diretório global | `RoomDirectory` Durable Object |
| Física autoritativa de cada sala | `ArenaMatch` Durable Object |
| Tráfego da partida | WebSocket jogador ↔ Durable Object |

Não há Firebase, Supabase, VPS, Docker, servidor doméstico, STUN ou TURN nesta variante. O WebSocket já atravessa NAT/CGNAT porque o navegador abre uma conexão de saída para a Cloudflare.

## Publicar automaticamente pelo GitHub

1. Entre em `dash.cloudflare.com` e selecione sua conta.
2. Abra **Workers & Pages** e escolha criar/importar uma aplicação.
3. Escolha **Import a repository** ou **Connect to Git** e autorize o GitHub.
4. Selecione `danipaises/countryballs-the-game`.
5. Configure:
   - Production branch: `main`
   - Root directory: `/`
   - Build command: `npm run build:web`
   - Deploy command: `npx wrangler deploy`
6. Salve e inicie o deploy.

Workers Builds usa a versão do Wrangler fixada no `package-lock.json`. O deploy lê `wrangler.jsonc`, cria as duas classes Durable Object SQLite pela migração `v1` e publica os assets da pasta `apps/web/dist`.

Nenhum secret é necessário para este MVP. A integração do próprio painel gera/gerencia o token de deploy; não copie esse token para o repositório.

## Primeiro teste

Após o status **Success**:

1. abra a URL `countryballs-the-game.<seu-subdominio>.workers.dev`;
2. crie uma sala privada;
3. copie o código `CB-XXXXXX`;
4. abra uma janela anônima ou outro aparelho;
5. entre pelo código;
6. clique em **Estou pronto** nos dois clientes;
7. teste movimento, ataque, HP, placar e revanche.

## Domínio próprio (opcional)

No Worker, abra **Settings → Domains & Routes → Add → Custom Domain** e informe, por exemplo, `jogos.seudominio.com`. O domínio precisa estar na mesma conta Cloudflare. A URL `workers.dev` é suficiente para começar.

## Publicação manual alternativa

No Windows, macOS ou Linux:

```sh
npm ci
npm run verify
npm run cf:check
npx wrangler login
npm run deploy
```

O login abre uma página oficial da Cloudflare. Senha, código de autenticação e token devem ser digitados somente pelo proprietário da conta; não pertencem ao código nem ao chat.

## Custo e proteção

- Assets estáticos do Worker são servidos sem cobrança por requisição/armazenamento de assets segundo a documentação atual da Cloudflare.
- Durable Objects SQLite podem ser usados no plano Free, sujeitos às cotas do plano.
- No plano Free, exceder a cota normalmente interrompe/limita requisições; não transforma automaticamente o projeto em uma conta paga.
- O MVP usa `WebSocket.accept()` e mantém a simulação ativa durante uma partida. Isso consome duração do Durable Object enquanto houver jogadores. Antes de tráfego público significativo, configurar alertas/limites de faturamento e medir partidas reais.
- Migrar a conexão para WebSocket Hibernation pode reduzir duração ociosa, mas o tick contínuo de uma partida em andamento ainda exige computação.

Consulte os preços no painel antes de ativar um plano pago. Não habilite upgrade automático ou adicione cartão apenas para testar a cota gratuita sem antes revisar o limite desejado.

## Rollback e observação

- **Workers & Pages → countryballs-the-game → Deployments** mostra versões e permite rollback.
- **Observability / Logs** está habilitado em `wrangler.jsonc`.
- Durable Objects não armazenam IP no modelo de sala e o diretório público nunca retorna códigos privados.
- Salas vazias são removidas após uma hora.

## Checklist de produção

- build do GitHub aprovado;
- teste com dois navegadores em redes diferentes;
- orçamento e alertas definidos;
- rate limiting de borda/WAF configurado para `/api/rooms` antes de divulgação ampla;
- política de privacidade e termos publicados;
- domínio e HTTPS verificados;
- teste de 8 jogadores e sessão longa executado;
- estratégia de reconexão implementada antes de chamar a versão de estável.
