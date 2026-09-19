# Roadmap

## Linha Cloudflare atual

| Marco | Estado | Evidência/saída |
|---|---|---|
| Arquitetura, interfaces e protocolo | Concluído | pacotes tipados e testes de contrato |
| Worker + diretório de salas | Concluído no código | Durable Object SQLite e API |
| Arena 2D local/headless | Concluído | simulação e testes |
| Arena multiplayer Cloudflare | MVP implementado | WebSocket, snapshots, lobby, partida e revanche |
| Salas públicas/privadas | MVP implementado | lista pública e código opaco |
| PWA e mobile web | MVP implementado | manifest, service worker e touch |
| Deploy e teste entre aparelhos | Ação do proprietário | conectar GitHub à conta Cloudflare |
| Reconexão de sessão | Próximo | ticket de retomada, backoff e snapshot completo |
| Matchmaking automático | Próximo | seleção por região/carga/latência medida |
| Produção pública | Pendente | rate limiting, observabilidade, testes de carga e política |
| Kart 3D | Futuro | somente após estabilidade/custo da Arena |

## Linha comunitária preservada

Os contratos, políticas de benchmark, heartbeat, reservas e provider comunitário da Fase 1 continuam no repositório. O aplicativo desktop/Android e WebRTC não são necessários para o deploy Cloudflare e permanecem opcionais. Eles poderão retornar como modo comunitário por configuração, sem mover regras para o frontend.

## Próxima sequência segura

1. Publicar a versão atual em `workers.dev`.
2. Testar o fluxo funcional com dois navegadores reais.
3. Corrigir qualquer diferença do runtime Cloudflare observada nos logs.
4. Implementar reconexão no provider Cloudflare.
5. Testar 8 jogadores, perda de conexão e partidas longas.
6. Medir uso de Durable Objects e estabelecer orçamento.
7. Adicionar rate limiting e, se necessário, Turnstile para criação de salas.
8. Implementar matchmaking e perfis somente depois da operação básica estar estável.
