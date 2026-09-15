# Fases e critérios de saída

| Fase | Escopo | Estado desta entrega | Verificação necessária |
|---|---|---|---|
| 1 | Arquitetura, tipos, interfaces e protocolo | Implementada | Build, contratos, fronteiras e documentação |
| 2 | CountryBalls Server mínimo | Próxima | CLI, supervisor, worker, ciclo de start/stop e coletor de medições |
| 3 | Diretório e signaling | Planejada; domínio em memória já testado | HTTPS/WS, autenticação, confirmação de alocação, TTL periódico, rollback e rate limiting de borda |
| 4 | WebRTC | Planejada; contratos de transporte prontos | Dois dispositivos, handshake, TURN, CGNAT, relay-only, reconexão |
| 5 | Arena local | Planejada; manifesto/regras prontos | Simulação headless e renderização Phaser; colisões, dano, respawn e cronômetro |
| 6 | Arena multiplayer | Planejada | 2–8 clientes reais, snapshots, interpolação, autoridade, placar, fim e revanche |
| 7 | Matchmaking | Política inicial testada | Medição de ping real, seleção de sala existente versus novo host, retry atômico |
| 8 | Salas privadas | Contratos testados | UI, código/link/QR, convites, escopo do dono e limites de enumeração |
| 9 | LAN | Planejada | ICE local, descoberta nativa, coordenador offline e permissões de navegador |
| 10 | PWA/mobile | Planejada | Shell responsivo, manifest/SW, joystick, tela segura, cache e atualização por versão |
| 11 | Android Server | Planejada | Serviço foreground, runtime/RTC nativos, térmica, consumo, reconexão e parada |
| 12 | Otimizações | Planejada | Bots reais, jitter/perdas, perfis por hardware/jogo, tráfego, memória e long runs |
| 13 | Kart 3D | Futuro | Rede estável, base 3D e benchmark próprio antes de anunciar capacidade |

## Marco funcional completo

Abrir site → Arena → iniciar host em outro computador → registro e descoberta → criar sala → dois navegadores entram → mover e atacar → HP/placar/cronômetro corretos → encerrar → lobby → host aceita nova partida.

Só declarar esse marco concluído após teste entre dispositivos reais. Depois expandir para 8 clientes e múltiplas partidas. Esta entrega de Fase 1 não atinge esse marco.

## Fase 2 em tarefas concretas

1. Criar entrada Node do CountryBalls Server e configuração local validada.
2. Implementar supervisor e workers com um GameRuntime de teste para medir agendamento e encerramento.
3. Coletar CPU/RAM/event-loop, medir workload sintético explicitamente identificado e planejar perfil real da Arena.
4. Implementar start, drain, stop e logs com redação; não abrir endpoint público por conveniência.
5. Rodar testes de queda de worker e encerramento seguro.
6. Manter benchmark público não qualificado até medição representativa + teste de rede.

A sequência solicitada põe WebRTC antes da Arena local. Isso é possível usando echo/ping e um runtime mínimo de integração na Fase 4; não apresentar esse teste como Arena jogável. O benchmark final será recalibrado na Fase 6/12 usando a simulação real.

## Gates de rede e produção

Na Fase 3, o adaptador HTTP precisa validar request/response, controlar login/registro e impedir uso como relay aberto. Na Fase 4, validar que o host Electron permanece funcional sem foco. Antes de publicar, TLS, TURN, credenciais temporárias, observabilidade e limites devem estar operacionais.

O Android permanece dependente de prova técnica de runtime e WebRTC. Não prometer que executar o JavaScript dentro de uma WebView basta para hospedagem em segundo plano.
