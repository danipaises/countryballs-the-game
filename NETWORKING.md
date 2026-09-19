# Rede do MVP Cloudflare

## Topologia atual

Cada navegador abre um WebSocket de saída para o `ArenaMatch` Durable Object da sala. Como o destino é a Cloudflare, não há abertura manual de porta, descoberta de IP, STUN, TURN ou signaling WebRTC neste modo.

O Worker emite um ticket aleatório temporário. O Durable Object consome o ticket, associa `playerId` à conexão e aceita mensagens somente para a própria sala. O cliente nunca escolhe outro jogador como origem.

## Ritmos e canais lógicos

- simulação: 30 ticks/s com delta fixo;
- snapshots: 15/s;
- input do navegador: até 20/s na UI atual;
- silêncio de input por 250 ms: vetor volta a zero;
- `INPUT_FRAME`: estado atual da direção, descartável e sequenciado;
- `CLIENT_COMMAND`: ataque/pronto/revanche, confiável e deduplicado;
- `STATE_SNAPSHOT`: estado compacto de todos os jogadores;
- `SERVER_EVENT`: mudanças confiáveis e roster.

WebSocket é um transporte confiável único, mas o protocolo mantém categorias lógicas. Isso permite mapear `INPUT/STATE` para DataChannel não confiável no futuro sem alterar o jogo.

## Autoridade

O cliente envia `{move:[x,y]}` e `attack`. O Durable Object decide deslocamento, limites, colisões, alcance, cooldown, dano, morte, respawn, pontos e fim. Inputs são normalizados e limitados; mensagens fora de sequência, excessivas ou grandes são rejeitadas.

## Apresentação

Snapshots carregam posições em décimos de unidade e dados essenciais. A cena interpola visualmente por um intervalo curto. Prediction/reconciliation e ACK por jogador estão previstos no envelope, mas ainda não implementados.

## Queda e reconexão

Nesta versão, fechar o socket remove o jogador e atualiza a sala. O cliente mostra o motivo de encerramento, mas ainda não obtém ticket de retomada. A próxima versão deverá manter uma sessão curta, emitir novo ticket, conservar `playerId`, reenviar snapshot completo e aplicar backoff dentro de um prazo global.

Não existe host migration. Durable Objects substituem o computador comunitário neste modo, mas uma falha definitiva ainda encerra aquela conexão.

## Caminho comunitário futuro

As interfaces WebRTC, signaling, ICE, LAN e políticas de reconexão continuam no monorepo para um provider comunitário opcional. Nesse modo, ICE deve preferir o caminho viável (inclusive LAN) e usar TURN quando necessário. Ele não participa do deploy atual e não deve ser confundido com uma funcionalidade já testada.
