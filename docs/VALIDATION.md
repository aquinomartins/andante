# Validação — 14/10/2026

Ambiente disponível: Linux na nuvem, Node 24.19.0, Chromium headless 154.0.8037.57 e Playwright 1.64.1. Nenhuma câmera física disponível. Referência visual aplicada a partir da descrição: não foi recebido arquivo de vídeo.

## Checagens executadas

| Verificação | Resultado e escopo |
| --- | --- |
| TypeScript + build de produção | Passou; modelo/WASM locais e compatíveis, hashes verificados |
| 4 testes de controle | Passaram: duas direções, frenagem/parada, velocidade/aceleração limitadas, perda breve/prolongada, retorno sem salto, zona morta, dt limitado e destino preciso por mouse/toque |
| 10 testes funcionais no Chromium | Passaram: mouse, reset, layout/rotação de viewport, economia; modelo real em Worker e CPU na página; dedo indicador/polegar; perda/retorno; seleção simulada de câmera; início/parada repetidos; permissão negada; modelo indisponível; abertura cancelada; fallback sem ImageBitmap/requestVideoFrameCallback; interrupção de trilha; mensagem de HTTPS; desenho mantido em redimensionamento após pausa |
| Build servido em `/caminhante/` | Passou: detecção com modelo real, recursos carregados na subpasta, trilha e Worker encerrados, nenhuma conexão externa permitida, sem erros JavaScript |
| Observação por cinco minutos | Resultados abaixo; inferência real com captura sintética |

O teste de estabilidade fica **ignorado no comando curto** `test:browser` e é executado separadamente por `test:stability`. Isso evita tratar o teste ignorado como aprovado. Os testes de câmera usam uma imagem oficial de mão renderizada numa stream Canvas; não usam mocks para o detector ou modelo. Nos testes de câmera ausente/permissão/HTTPS, a condição é simulada. As trocas verificam encerramento e reabertura das streams; não comprovam seleção de lentes de um aparelho físico.

A imagem de teste vem de `https://storage.googleapis.com/mediapipe-assets/pointing_up.jpg`, também referenciada pelo teste oficial `hand_landmarker_test.py` do projeto MediaPipe. A fixture fica fora do build de produção.

## Observação de estabilidade

A primeira execução durou 302,5 segundos: desenho mediano 60 FPS, detecção mediana 9 Hz e inferência mediana 44,6 ms. O heap JavaScript da página após GC variou entre 3,38 e 3,43 MB; crescimento entre a amostra após aquecimento e a última: 31.880 bytes. Em toda amostra houve um Worker. Ao parar: zero Workers, trilha encerrada e animação parada. Registro completo em `stability-before-csp.json`.

A versão com a política de rede final passou em uma segunda execução de 302,1 segundos: desenho mediano **60,0 FPS**, detecção mediana **10,8 Hz**, inferência mediana **46,6 ms**. Crescimento do heap após aquecimento: **30.844 bytes**. As amostras variaram entre 3.379.472 e 3.428.516 bytes. Um Worker por amostra, zero após parar, câmera encerrada e animação parada. Sem erros JavaScript. Registro completo em `stability.json`.

A frequência real pode ficar abaixo da frequência solicitada de 20/24 Hz por custo do detector, disponibilidade de quadros e descarte enquanto ocupado. Não foi observada fila de imagens ou degradação progressiva no ensaio. FPS, Hz e tempo são amostras desse Chromium, com captura sintética, e não estimativas de desempenho em celulares. Houve mudança de viewport entre desktop, retrato e paisagem durante a observação.

A medição de heap se refere à página após coleta de lixo forçada pelo CDP. Não mede toda a memória nativa, GPU, pool WASM ou memória do Worker. A contagem estável de Workers e seu encerramento foram verificados; não é uma prova geral de ausência de vazamentos em qualquer aparelho.

## Limitações e validação em aparelhos

Não executados: câmera física, Chrome/Edge de usuário em desktop, Chrome Android, Safari iPhone, GPU, mudanças reais de orientação/lentes e teste de cinco minutos nesses aparelhos. A emulação de tamanhos no Chromium cobre layout; não comprova compatibilidade com Android/iOS. O caminho CPU foi escolhido e testado. Quando o rastreamento não é utilizável, mouse/toque permanece ativo.

Antes de anunciar suporte nesses alvos, abrir em HTTPS e observar por cinco minutos em cada aparelho: mão inteira em diferentes iluminações, indicador/polegar, ambas as mãos, movimento nas duas direções, parada/tremor, ausência breve/prolongada, retorno, rotação, frente/traseira, repetidos início/parada, prévia/tela cheia quando suportadas e diagnóstico. Confirmar o indicador do sistema para câmera encerrada e ausência de queda progressiva de FPS ou crescimento persistente de memória. Não há resultados de aparelhos reais nesta entrega.


## Publicação em hospedagem compartilhada — correção

O usuário informou ter extraído o ZIP de código-fonte (ou download do GitHub) em `/andante/`, usando Chrome no computador. Esse pacote referencia `/src/main.ts`, exige compilação e não inicia em hospedagem estática. O cenário foi reproduzido num servidor estático: canvas vazio, botão clicável sem handler e nenhuma solicitação de câmera. O domínio real não pôde ser inspecionado porque a política de rede do ambiente bloqueou a conexão antes do servidor.

O pacote de produção atualizado mantém os arquivos compilados na raiz do ZIP e inclui `.htaccess` para MIME/cache, mensagem de inicialização malsucedida, controles habilitados somente após inicialização e página `verificar.html` com manifesto de arquivos. Os 14 testes de navegador executados inicialmente passaram. Os cinco testes específicos de publicação também passaram, incluindo a reprodução da publicação equivocada de fonte (15 cenários distintos validados). O build e o smoke test de produção em subpasta passaram com detector real e captura sintética. A correção precisa ser enviada à hospedagem pelo proprietário; não houve acesso SFTP/cPanel nem publicação remota automática.
