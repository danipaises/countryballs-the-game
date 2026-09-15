# Protocolo inicial

Platform 0.1.0 · Server 0.1.0 · Protocol 1 · arena-2d 0.1.0.

## Formato implementado

JSON UTF-8 compacto, sem whitespace de formatação, codificado como Uint8Array. `MessageCodec` permite migrar para MessagePack/Protobuf sem alterar a API do jogo. O codec binário deve ser negociado e versionado antes de trocar o formato em produção.

Envelope obrigatório: `v`, `matchId`, `kind`, `type` e campos da variante. Campos extras são rejeitados; payload de jogo permite somente JSON limitado e será validado novamente pelo módulo.

| Categoria | Tipo | Direção | Canal | Campos adicionais |
|---|---|---|---|---|
| INPUT | INPUT_FRAME | cliente → host | realtime | seq, tick, payload |
| STATE | STATE_SNAPSHOT | host → cliente | realtime | tick, ack, payload |
| EVENT | CLIENT_COMMAND | cliente → host | reliable | commandId, name, payload |
| EVENT | SERVER_EVENT | host → cliente | reliable | eventId, tick, name, payload |
| SYSTEM | HELLO | cliente → host | reliable | gameId, gameVersion, ticket |
| SYSTEM | WELCOME | host → cliente | reliable | playerId, tickRate, snapshotRate |
| SYSTEM | PING / PONG | ambos | reliable | nonce |
| SYSTEM | ERROR | host → cliente | reliable | code, message |

Exemplo de input de movimento:

```json
{"v":1,"matchId":"match-1","kind":"INPUT","type":"INPUT_FRAME","seq":17,"tick":301,"payload":{"move":[1,0]}}
```

Exemplo de intenção de ataque:

```json
{"v":1,"matchId":"match-1","kind":"EVENT","type":"CLIENT_COMMAND","commandId":4,"name":"attack","payload":null}
```

Nomes previstos de SERVER_EVENT: PLAYER_JOIN, PLAYER_LEAVE, MATCH_START, PLAYER_DAMAGED, PLAYER_RESPAWN, SCORE_CHANGED, MATCH_END. O envelope é implementado; a emissão desses eventos pela simulação é Fase 6. `CLIENT_COMMAND` nunca autoriza o cliente a declarar uma vitória.

## Invariantes

- Host ignora qualquer playerId alegado em payload: identidade vem do ticket e da conexão admitida.
- seq e commandId crescem por sessão; eventId cresce por stream confiável; tick cresce na rodada/runtime. São uint32. Abrir nova sessão/epoch antes de overflow.
- ProtocolReceiver aplica quota antes de parse, verifica direção/canal/sala e descarta IDs repetidos ou fora de ordem. Guard é por participante e partida.
- Tráfego pré-admissão só pode negociar HELLO. Adapter do host deve consumir ticket e emitir WELCOME antes de construir/habilitar o receiver de comandos autenticados.
- O relógio/tick sugerido pelo cliente não altera velocidade nem duração da rodada.
- Eventos confiáveis descrevem transições; snapshots trazem estado atual e permitem reconstrução.
- Não há ordenação global entre canais. O runtime usa tick/IDs para associar eventos ao estado.
- O renderer trata nomes como texto, não como HTML.

## Limites implementados

| Limite | Default |
|---|---:|
| Frame realtime | 1.200 bytes |
| Mensagem reliable | 8.192 bytes |
| Profundidade JSON | 8 |
| Nós no payload | 2.048 |
| Texto no payload | 2.048 caracteres |
| Inputs/frames realtime por participante | 60/s, burst 60 |
| Mensagens reliable por participante | 20/s, burst 20 |
| Jogadores por partida | 8 |
| Ticks de simulação | 30/s |
| Snapshots | 15/s |

1.200 bytes é orçamento de payload inicial, não garantia de MTU total: SCTP/DTLS/UDP adicionam overhead. A simulação deve serializar oito jogadores dentro desse orçamento. Mapas e assets grandes não trafegam a cada snapshot; são distribuídos por versão e carregados antes.

Config de taxas, bytes, slots e prazos fica em `packages/config`. Limites estruturais do JSON são parte do codec v1; mudanças incompatíveis exigem revisão de protocolo. Valores de capacidade, pesos e balanceamento ficam nos módulos correspondentes.

## Segurança de parsing

Rejeita JSON malformado, UTF-8 inválido, chaves perigosas, objetos não serializáveis, NaN/Infinity, mensagens grandes, campos inesperados, tipo/categoria incoerentes, sequência inválida e versões incompatíveis. Limite de bytes é checado antes do parse.

Tipagem não elimina validação. Além do envelope, validar input/commands no jogo e autenticar sessão/canal. O protocolo não implementa TLS, TURN ou autenticação sozinho.

## Compatibilidade

Protocolo exige igualdade com 1. Manifesto de jogo exige gameId e gameVersion compatíveis; a referência usa igualdade exata. Versões de plataforma e servidor são anunciadas independentemente e validadas no registro. No futuro, uma matriz explicitamente testada pode liberar versões patch compatíveis.

Um cliente incompatível recebe INCOMPATIBLE_VERSION, sem tentar jogar “mesmo assim”. BackendProvider não suprime esse erro.

## Evoluções previstas

Codec binário, input redundante compacto, delta snapshots e compressão apenas depois de medir. Prediction/interpolation/reconciliation estão previstas pelos campos, mas não implementadas. Checkpoints têm formato de contrato, sem migração automática. Decoder de signaling é separado do codec de mensagens de jogo e será implementado com seu limite de 64 KiB.
