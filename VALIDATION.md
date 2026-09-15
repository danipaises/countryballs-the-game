# Validação da Fase 1

Validado em 15 de setembro de 2026 com Node.js 24.

## Resultado

- `npm run verify`: aprovado.
- 47 testes automatizados: 47 aprovados, 0 falhas.
- Fronteiras: 11 módulos e 52 imports/exports verificados.
- Demonstração: dois convidados entraram em uma sala privada, o host iniciou e encerrou a rodada, os jogadores voltaram ao lobby e o host continuou registrado.
- Carga sintética: 3 hosts, 12 salas, 96 jogadores e 28.800 mensagens de input em 10 segundos virtuais; todos os jogadores foram liberados no fim.

## O que os testes cobrem

Protocolo, limites de bytes, UTF-8 e JSON inválidos, replay, flood, autoridade de direção, versão incompatível, capacidade, reserva do host, oito jogadores, salas simultâneas, convites, heartbeat, expiração, ticket de uso único, reconexão, ciclo de sala, seleção de host e falhas de transporte usando um fake controlado.

## Limite da evidência

A carga é um teste dos contratos em memória. Não mede WebRTC, CGNAT, TURN, upload, latência, hardware do host, Phaser, física real, Electron ou Android. Esses itens exigem as fases correspondentes e testes entre dispositivos físicos.

O projeto também não possui aplicação web ou Worker implantável nesta fase. `CLOUDFLARE_DEPLOYMENT.md` registra a arquitetura e a ordem necessária para publicação.
