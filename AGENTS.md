# Continuação do CountryBalls Games

- Leia README.md, ARCHITECTURE.md, ROADMAP.md e VALIDATION.md antes de alterar arquitetura.
- Preserve a separação backend / hospedagem / transporte. Jogos só usam API interna; física não importa engine de apresentação nem SDK de fornecedor.
- O escopo concluído é a Fase 1. O próximo passo é o runtime mínimo do host. Não marcar fases posteriores concluídas por testes em memória.
- TypeScript estrito, pacotes pequenos, dependências declaradas e configuração central. Não introduzir Docker, WSL, Hyper-V ou VM.
- Rode `npm run verify` após mudanças de código e atualize os testes de invariantes afetados.
- Rode demo/carga apenas se o domínio/protocolo foi modificado; carga sintética não é teste WebRTC nem benchmark de hardware.
- Não criar credenciais, hosts online, pings ou métricas fictícios numa UI sem identificação explícita de dados de demonstração.
- `saveStats`/`getLeaderboard` não estão implementados. Futuro provider sem implementação deve falhar claramente.
- Não instalar assets de franquias comerciais. Assets CountryBalls e mapas devem ter origem própria/permitida.
- Registre decisões e limites de validação em documentos; preserve lockfile e testes de fronteiras.
