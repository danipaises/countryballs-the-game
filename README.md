# CountryBalls Games

Plataforma web/PWA modular de jogos multiplayer. A primeira experiência jogável é **CountryBalls Arena 2D**, com 2–8 jogadores, salas públicas e privadas e simulação autoritativa.

**Plataforma 0.2.0 · Arena 0.1.0 · protocolo 1**

## Estado atual

Esta versão é um MVP full-stack pronto para implantação na Cloudflare:

- React + Vite para o site/PWA responsivo;
- Phaser carregado sob demanda para renderizar a Arena;
- um Worker serve o site e a API;
- `RoomDirectory` Durable Object mantém o diretório de salas;
- um `ArenaMatch` Durable Object isolado executa cada partida;
- WebSocket envia inputs, snapshots e eventos;
- servidor calcula movimento, colisões, HP, ataque, cooldown, respawn, placar, cronômetro e vitória;
- salas públicas, salas privadas por código, lobby, pronto e revanche;
- controles WASD/setas/espaço e controles touch;
- 50 testes automatizados e verificação de build/deploy.

Amigos, contas persistentes, ranking global, matchmaking automático, reconexão da sessão Cloudflare e o Kart 3D continuam como etapas posteriores. O código comunitário da Fase 1 permanece no monorepo como outro provider possível; ele não participa do deploy Cloudflare atual.

## Executar

Requisito: Node.js 24. Não usa Docker, WSL nem máquina virtual.

```sh
npm ci
npm run verify
npm run build:web
npm run dev
```

Abra o endereço exibido pelo Wrangler. Em alguns ambientes virtuais restritos, `wrangler dev` pode não conseguir enumerar interfaces de rede; a verificação de bundle continua disponível com `npm run cf:check`.

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Verifica núcleo, Worker e frontend com TypeScript estrito |
| `npm run verify` | Compila, executa 50 testes e valida fronteiras entre módulos |
| `npm run build:web` | Gera a PWA em `apps/web/dist` |
| `npm run cf:check` | Faz a build web e um deploy Cloudflare em modo `--dry-run` |
| `npm run deploy` | Verifica tudo, compila e publica com Wrangler |

## Organização

```text
apps/
  web/                 React, PWA, Phaser e providers do navegador
  cloudflare/          Worker, API e Durable Objects
packages/
  cloud-contracts/     DTOs da implantação Cloudflare
  game-core/           contratos independentes de engine/provider
  protocol/            envelopes, codec, quotas e validação
  backend-interface/   interface de backend
  transport-interface/ interface de transporte
  network-core/        API interna de partida
  community-provider/  provider comunitário preservado para evolução
games/
  arena-2d/            regras e simulação autoritativa headless
tests/                 contratos, segurança e regras da Arena
```

O módulo `games/arena-2d` não importa React, Phaser, Cloudflare, Firebase ou Supabase. O frontend seleciona `CloudflareBackendProvider` e `CloudflareHostProvider` em um único ponto de composição. A troca futura exige um novo adaptador, não mudanças nas regras do jogo.

## Implantar

O caminho mais simples é conectar este repositório ao **Workers Builds** da Cloudflare. Use:

- branch de produção: `main`;
- diretório raiz: `/`;
- comando de build: `npm run build:web`;
- comando de deploy: `npx wrangler deploy`.

O arquivo `wrangler.jsonc` já declara assets, bindings e migração SQLite dos Durable Objects. Veja [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) para o passo a passo e os limites de custo.

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) — decisões e fronteiras.
- [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) — publicação pelo painel/GitHub.
- [PROTOCOL.md](PROTOCOL.md) — mensagens da partida.
- [BACKEND_PROVIDERS.md](BACKEND_PROVIDERS.md) — troca de provider.
- [ADDING_A_GAME.md](ADDING_A_GAME.md) — adicionar outro jogo.
- [ROADMAP.md](ROADMAP.md) — concluído e próximos marcos.
- [VALIDATION.md](VALIDATION.md) — evidências e limites dos testes.

Os visuais atuais são geométricos e provisórios, produzidos pelo próprio código. Nenhum personagem, mapa ou asset de franquias comerciais foi copiado.
