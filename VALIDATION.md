# Validação da versão 0.2.0

Validado em 16 de setembro de 2026 com Node.js 24.

## Resultado executado

- `npm run typecheck`: aprovado para pacotes, Worker e frontend.
- `npm test`: 50/50 testes aprovados.
- `npm run build:web`: aprovado; shell inicial separado do chunk Phaser.
- `wrangler deploy --dry-run`: aprovado; assets, Worker, bindings `DIRECTORY`/`MATCHES` e variáveis reconhecidos.
- verificação de fronteiras dos pacotes: incluída em `npm run verify`.

Os novos testes headless cobrem início somente com dois jogadores prontos, movimento decidido pelo servidor, input expirado, ataque/cooldown, dano, pontuação, respawn e encerramento seguro por saída.

## Limites da evidência

O ambiente de desenvolvimento usado nesta validação bloqueou `uv_interface_addresses`, então o servidor local do Wrangler não pôde abrir uma porta. Isso é uma restrição do ambiente virtual, não uma falha de bundle; o teste integrado de HTTP/WebSocket deve ser feito no primeiro deploy Cloudflare.

Ainda não foram validados em dispositivos físicos:

- 8 navegadores simultâneos;
- redes móveis e troca Wi‑Fi/dados;
- sessões longas e custo observado;
- reconexão após queda;
- instalação PWA em Android/Windows;
- gamepad e navegadores além de Chromium.

O MVP não possui autenticação persistente, ranking confiável ou proteção de abuso suficiente para divulgação ampla. O host Cloudflare é autoritativo para cheats básicos do cliente, mas isso não substitui rate limiting de borda, moderação e operação de produção.
