# Providers substituíveis

## Regra

Módulos em `games/` nunca importam Cloudflare, Firebase, Supabase, React ou uma engine. Eles expõem runtime e tipos puros. O aplicativo escolhe providers na borda.

Na aplicação web, `apps/web/src/providers.ts` define:

- `PlatformBackendProvider`: listar, criar e entrar em salas;
- `BrowserGameServerProvider`: abrir uma conexão de partida;
- `CloudflareBackendProvider`: adaptador HTTP atual;
- `CloudflareHostProvider`: adaptador WebSocket atual.

O provider selecionado por `VITE_BACKEND_PROVIDER` é validado. Somente `cloudflare` está instalado no bundle atual; qualquer outro valor gera erro claro.

## Adicionar outro backend

1. crie um pacote/adaptador isolado;
2. implemente a interface interna sem expor SDK ao jogo;
3. valide respostas externas em runtime;
4. converta erros para erros de domínio compreensíveis;
5. preserve IDs opacos, expiração, autorização, compatibilidade e atomicidade;
6. registre a implementação no ponto de composição;
7. execute a suíte de contratos contra ela.

Trocar a configuração não cria infraestrutura automaticamente. O provider precisa existir e demonstrar suas capacidades.

## Hospedagem de partida

O `CloudflareHostProvider` atual entrega um `MatchClient` com `sendInput`, `command`, `subscribe` e `close`. Uma futura implementação comunitária pode entregar o mesmo comportamento sobre WebRTC; um host dedicado pode usar WebSocket. A cena Phaser não precisa saber onde a simulação roda.

O monorepo também conserva as interfaces mais amplas `BackendProvider`, `GameServerProvider` e `Transport` da arquitetura comunitária. Elas cobrem registro/heartbeat de hosts e continuam válidas para reativar esse modo. Os DTOs menores de `cloud-contracts` evitam fingir hosts comunitários no deploy Cloudflare.

## Cloudflare → outro fornecedor

A migração típica envolve:

- implementar os dois providers novos;
- criar a infraestrutura de diretório e runtime;
- migrar somente os dados que realmente existirem (futuramente contas/estatísticas);
- selecionar o provider na composição;
- manter protocolo e `GameRuntime` quando o novo host os suportar.

Supabase/Firebase podem implementar identidade/diretório, mas não viram um servidor de física apenas por armazenarem dados. O provider de partida precisa executar o loop autoritativo em um runtime apropriado.
