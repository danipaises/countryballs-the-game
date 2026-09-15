# Backend e hospedagem substituíveis

## Princípio

Jogos importam Game Networking API e tipos do núcleo. Nunca importam um SDK de Firebase, Supabase, Cloudflare ou outro provedor. Os três eixos são escolhidos na composição do aplicativo:

```json
{
  "backendProvider": "community",
  "gameServerProvider": "community",
  "transport": "webrtc",
  "privacy": "direct",
  "coordinatorUrl": "https://coordenador.example"
}
```

O domínio `.example` é documentação; não é um serviço disponível. A Fase 1 não faz requisições a esse endereço. Chaves de assinatura, credenciais permanentes e tokens administrativos não pertencem a esse JSON público.

## Composição executável da Fase 1

```ts
import {
  CommunityBackendProvider,
  InMemoryCommunityCoordinator,
  createBackendProvider,
} from '@countryballs/community-provider';

const coordinator = new InMemoryCommunityCoordinator();
const backend = createBackendProvider('community', {
  community: () => new CommunityBackendProvider(coordinator),
});
await backend.login('Brasil');
```

`tools/contract-demo.mjs` executa a composição completa. O coordinator é uma implementação **local de referência** do CommunityGateway. O mesmo CommunityBackendProvider poderá receber `HttpCommunityGateway` na Fase 3. Jogos não perceberão essa mudança.

Para partidas, `CommunityHostProvider` recebe BackendProvider, TransportFactory e MessageCodec. `joinMatch` reserva entrada, abre transporte e envia HELLO; `MatchConnection.isReady` só é true após WELCOME do host. Falha de abertura devolve a vaga. Os testes usam um fake de transporte, não um serviço WebRTC.

## Criar um novo backend

1. Criar pacote isolado, por exemplo `packages/cloudflare-backend`.
2. Implementar BackendProvider diretamente ou CommunityGateway quando a semântica for a mesma.
3. Mapear erros do fornecedor para DomainError sem expor detalhes internos ao jogo.
4. Validar todas as respostas externas em runtime; tipos TypeScript não validam uma resposta HTTP.
5. Preservar TTL, idempotência, autorização e reserva atômica. Rodar a mesma suíte de contratos contra o novo adaptador e acrescentar testes reais de concorrência.
6. Declarar capacidades ausentes como UNSUPPORTED_FEATURE. Não fabricar dados de ranking ou sucesso de persistência.
7. Registrar a fábrica na raiz de composição e alterar configuração. A fábrica existente rejeita providers não registrados.

```ts
// Exemplo FUTURO: CloudflareBackendProvider ainda não existe.
const factories = {
  community: () => new CommunityBackendProvider(httpGateway),
  cloudflare: () => new CloudflareBackendProvider(cloudflareGateway),
};
const backend = createBackendProvider(config.backendProvider, factories);
```

A mudança envolve implementar/configurar o adaptador; editar apenas uma string não cria infraestrutura nem migra dados automaticamente. Projetar exportação/importação de IDs, perfis e sessões ao adicionar persistência. Sessões temporárias em memória não sobrevivem a reinícios nesta fase.

## Criar um novo provedor de partidas

Implementar GameServerProvider e construir MatchConnection com a mesma semântica. `createMatch` aloca uma instância autoritativa. `joinMatch` autentica, negocia protocolo e só aceita comandos do jogador correspondente.

Um DedicatedHostProvider pode usar o mesmo transporte e runtime com instâncias gerenciadas. Um CloudflareHostProvider só será válido se o serviço escolhido executar a simulação no orçamento necessário; caso contrário, Cloudflare pode continuar sendo apenas o coordenador. Um banco de dados por si só não implementa GameServerProvider.

É permitido trocar o transporte para WebSocket numa infraestrutura que não suporte RTC, aceitando a semântica de rede diferente. O jogo continua usando sendInput/sendReliableEvent e snapshots. Documentar atraso, bloqueio entre mensagens, reconexão e limites de capacidade desse provider.

## Comunidade versus oficial

`PublicHost.trust` distingue community-casual de official-verified. A referência sempre atribui community-casual e não aceita que o host se autoproclame oficial. A implementação oficial futura exige credenciais de provisionamento e pipeline de resultados próprio.

Assinar o binário do host ajuda distribuição, não prova que uma partida de terceiros foi executada honestamente. Não misturar estatísticas comunitárias com ranking competitivo global.

## Contratos que uma troca deve preservar

- Diretório só expõe DTO público; sala privada não aparece em listagem.
- Ticket temporário, uso único, escopo host/sala/jogador.
- Heartbeat usa tempo de recebimento e expira automaticamente.
- Criação de sala e admissão verificam capacidade atomicamente.
- Retry de createRoom com requestId igual não cria outra sala.
- Reconexão retém identidade e rotaciona token; expiração libera slot.
- Erros de versão são compreensíveis ao usuário.
- Compatibilidade depende do jogo e protocolo, não só da plataforma.
- A física permanece no runtime de partida.

A classe em memória não deve ser exposta diretamente como RPC público. Faltam validação de request completo, autenticação de borda, limites por origem, armazenamento seguro e políticas operacionais, descritas em SECURITY.md.
