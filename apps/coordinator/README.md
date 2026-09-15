# Coordenador de rede — Fase 3

Esta pasta documenta o serviço futuro. O domínio atual é `InMemoryCommunityCoordinator`, não um servidor HTTP.

Mapeamento inicial proposto:

| Operação | Endpoint futuro | Autorização |
|---|---|---|
| login | POST /v1/sessions/guest | limite por origem e quota global |
| registerHost | POST /v1/hosts | registro limitado / desafio antiabuso |
| heartbeat | POST /v1/hosts/self/heartbeat | token do host |
| listServers | GET /v1/hosts | público com paginação/rate limit |
| listRooms | GET /v1/rooms | somente salas públicas |
| createRoom | POST /v1/rooms | convidado ou host; idempotência |
| findRoom | POST /v1/invites/resolve | convidado; não pôr código em logs |
| joinRoom | POST /v1/rooms/:id/join | convidado + convite quando privado |
| createInvite | POST /v1/rooms/:id/invites | criador da sala |
| consumeTicket | POST /v1/admissions/consume | host vinculado ao ticket |
| signaling | WSS /v1/signaling | sessão escopada por peer/sala |

Definir também logout, unregisterHost, leaveRoom, resume e transições da sala conforme CommunityGateway/AdmissionAuthority. Heartbeat observado no servidor tem prioridade sobre timestamp do cliente.

Em produção, reservar sala não é suficiente: host precisa confirmar worker pronto. Usar IDs de solicitação e expiração para desfazer reserva em caso de timeout. O endpoint público não expõe mapas internos em memória.

Single writer por host ou transação equivalente é obrigatório. A referência não oferece consistência distribuída. O serviço de controle não executa ticks de jogo.
