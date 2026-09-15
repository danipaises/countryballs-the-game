# Web/PWA — contrato de implementação futura

Fases 5/6 e 10. React + Vite + Phaser no renderer da Arena. Ainda não há aplicação web nesta pasta.

Rotas planejadas: /, /games, /play, /servers, /join/:code, /friends, /profile e /settings. O composition root constrói BackendProvider, GameServerProvider, TransportFactory e codec; views recebem interfaces.

Fluxo principal: catálogo → Arena → nome de convidado → jogar agora/criar/entrar por código → lobby → partida → resultado → revanche/lobby. Mostrar estados de busca, sem host, lotado, incompatível, conectando, reconectando e encerrado.

Pings precisam de medição jogador-host. Diretório público não exibe salas privadas; filtro privado deve mostrar entrada de código. Elementos futuros são indicados como indisponíveis.

Manifest PWA e service worker na Fase 10: cache de shell e assets versionados, exclusão de tokens/signaling, atualizar fora da partida e não prometer multiplayer offline sem coordenador LAN.

Mobile: joystick, ataque, áreas seguras, foco perdido, rotação e acessibilidade dos menus. Gamepad futuro. Não renderizar nomes como HTML.
