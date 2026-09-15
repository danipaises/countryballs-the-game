# Host desktop — próxima fase

Ainda não existe um binário ou serviço de rede nesta pasta. Implementar Fase 2 conforme COMMUNITY_SERVER.md e ROADMAP.md.

O núcleo Node deve carregar configuração, supervisionar workers GameRuntime, coletar medições e expor start/drain/stop. Integração de diretório é Fase 3; WebRTC é Fase 4. Electron é o caminho planejado de distribuição Windows para não exigir Node instalado pelo usuário final.

Cada worker fica limitado ao jogo/versão empacotados. Ao criar sala: reservar, inicializar worker, confirmar prontidão, só então aceitar jogadores. Falha libera reserva. Nunca expor APIs administrativas sem autenticação na rede local.
