# Segurança e privacidade

## Fronteiras de confiança

1. Cliente é não confiável: enviar intenção, validar envelopes e regras no host.
2. Host comunitário é não confiável: pode mentir sobre capacidade e resultados. Somente partidas casuais.
3. Coordenador autoriza descoberta/admissão: não delegar privilégios de diretório a campos enviados pelo host.
4. TURN observa metadados e retransmite bytes; não executa jogo nem garante honestidade do host.

## Implementado nesta base

IDs UUID aleatórios; tokens opacos de 256 bits; códigos aleatórios de 40 bits (`CB-` + oito caracteres sem ambiguidade); TTL de sessões/tickets/convites; ingresso com ticket de uso único; reconexão com rotação; labels sem controles/markup; quotas por sessão e por receiver; payload limitado; replay descartado; validação de direção e versão; DTO público sem endereço/token; privacidade de salas; reserva e capacidade sob uma seção crítica síncrona.

Códigos não são autenticação forte por identidade. Quem possui convite pode tentar entrar; expiração e proteção de tentativa são obrigatórias. Não usar código curto BR-7392 como padrão de segurança.

## Antes de expor à internet (ainda não implementado)

- HTTPS/WSS; origin allowlist e autorização no upgrade de WebSocket.
- Validadores completos de schemas HTTP e de signaling, com limite antes do parsing e erros genéricos.
- Rate limit por origem, sessão, host, método e total; quotas de login/registro anônimos, paginação e mitigação de abuso. Quotas em memória não protegem contra múltiplos processos ou botnets.
- Tokens só em canal autorizado; guardar hash de token no coordenador persistente, redigir logs e usar comparação apropriada. A referência guarda tokens brutos somente em memória e nunca é implantada como serviço público.
- Credenciais do host no armazenamento do sistema operacional; nunca no bundle público. Sessão de convidado não concede administração de host.
- Credenciais TURN temporárias, quotas de relay e autorização vinculada à admissão; sem TURN aberto.
- Limites de peers, candidatos, filas, bytes e tempo de handshake; watchdog por worker e descarte de inputs sem sessão admitida.
- Atomicidade distribuída, idempotência, confirmação de criação pelo host e rollback de reserva.
- Cache-Control apropriado para resposta privada; service worker não armazena tickets/SDP/perfis privados.
- Configuração de retenção e redação de logs. Dados de ICE/SDP nunca entram em diagnóstico público.
- Carregar apenas jogos empacotados/permitidos por versão. O host não executa código arbitrário enviado pelo jogador ou baixado de uma URL de sala.

## Limites de privacidade

Uma listagem sem IP não equivale a uma conexão anônima. WebRTC direto pode revelar endereço remoto aos peers. Relay-only deve ser explícito quando necessário, com o custo e a latência correspondentes. Mesmo com relay, serviços de controle ainda processam metadados.

Não haverá anticheat invasivo, coleta de processos ou inspeção de outros programas. Futuro ranking oficial exige infraestrutura e validação separadas. Assinatura de binário não torna confiável um administrador de host com controle do próprio sistema.
