# Continuação do CountryBalls Games

- Leia README.md, ARCHITECTURE.md, ROADMAP.md e VALIDATION.md antes de alterar arquitetura.
- Preserve a separação backend / hospedagem / transporte. Jogos só usam API interna; física não importa engine de apresentação nem SDK de fornecedor.
- O deploy ativo é o MVP Cloudflare 0.2.0: Static Assets + Worker + Durable Objects + WebSocket. O provider comunitário continua como alternativa, não como runtime do deploy atual.
- TypeScript estrito, pacotes pequenos, dependências declaradas e configuração central. Não introduzir Docker, WSL, Hyper-V ou VM.
- Rode `npm run verify` após mudanças de código e atualize os testes de invariantes afetados.
- Rode demo/carga apenas se o domínio/protocolo comunitário foi modificado; carga sintética não é teste WebRTC, Cloudflare nem benchmark de hardware.
- Não criar credenciais, salas online, pings ou métricas fictícios numa UI sem identificação explícita de dados de demonstração.
- `saveStats`/`getLeaderboard` não estão implementados. Futuro provider sem implementação deve falhar claramente.
- Não instalar assets de franquias comerciais. Assets CountryBalls e mapas devem ter origem própria/permitida.
- Registre decisões e limites de validação em documentos; preserve lockfile e testes de fronteiras.
