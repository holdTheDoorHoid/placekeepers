// Portuguese as spoken in Brazil (pt-BR): the interface text of web/src/strings.ts, key for key.
//
// How to translate, and how to check the result, is in docs/TRANSLATING.md; the key terms are
// written once in docs/i18n/glossary-pt-BR.md and used the same way here, in the registry text
// (registry/i18n/pt-BR.yaml) and in the content pages (content/pt-BR/).
//
// Rules: keep each key's meaning and every value a template shows (the tests check), no dashes
// as punctuation, and proper names as they are (Placekeepers, Philly311, LandCare).

import type { Catalog } from '../catalog.ts';
import { formatDecimal, formatNumber, plural } from '../format.ts';
import { distanceWords } from '../../strings.ts';

/**
 * A count with its noun. The plural rules of Portuguese call 0 and 1 both "one", but people write
 * "0 lugares", so zero takes the plural form here.
 */
function pl(n: number, one: string, other: string): string {
  return n === 0 ? plural(n, { other }) : plural(n, { one, other });
}

/** A change in percent as a noun phrase: "uma alta de 61%", "uma queda de 3%", "nenhuma mudança". */
function rise(n: number): string {
  if (n > 0) return `uma alta de ${formatNumber(n)}%`;
  if (n < 0) return `uma queda de ${formatNumber(-n)}%`;
  return 'nenhuma mudança';
}

/** The same change as a verb phrase: "subiu 61%", "caiu 3%", "ficou igual". */
function went(n: number): string {
  if (n > 0) return `subiu ${formatNumber(n)}%`;
  if (n < 0) return `caiu ${formatNumber(-n)}%`;
  return 'ficou igual';
}

/** " (margem de erro de 6 pontos)", or nothing when there is no margin: a survey's margin of error. */
function margemDeErro(margin: number | null, unit: 'points' | 'homes'): string {
  if (margin === null) return '';
  return ` (margem de erro de ${unit === 'points' ? pl(margin, '# ponto', '# pontos') : formatNumber(margin)})`;
}

/** The long name of all four land agencies together, which takes a plural verb in the Land Bank page. */
const ALL_AGENCIES = 'os quatro órgãos de terras juntos';

const ptBR: Catalog = {
  app: {
    name: 'Placekeepers',
    tagline: 'Um mapa gratuito para vizinhos da Filadélfia que cuidam do seu quarteirão.',
    mapLabel: 'Mapa da Filadélfia. As listas de lugares e de memoriais desta página mostram as mesmas coisas em texto.',
    loadingMap: 'Carregando o mapa',
    mapFailed: 'O mapa não conseguiu iniciar neste navegador. Tente outro navegador ou atualize este.',
    sampleData: 'Dados de exemplo para teste. Não são lugares reais.',
    earlyPreview: 'Versão 0.4: uma primeira versão pública. Confirme os fatos com a Prefeitura antes de agir.',
    followAlong: 'Acompanhe o projeto',
    skipToList: 'Ir para a lista de lugares',
    hideNote: 'Ocultar',
    hideNoteLabel: 'Ocultar esta nota',
    close: 'Fechar',
    notAffiliated: 'Sem ligação com a Prefeitura da Filadélfia nem com a SEPTA. Não é aconselhamento jurídico.',
    licenses: 'Código: GPL-3.0. Dados: cada fonte tem a sua própria licença. Textos: Creative Commons BY-SA 4.0.',
  },

  content: {
    tableLabel: 'Tabela, rola para os lados',
    removalEmail: (email) =>
      `Escreva para [${email}](mailto:${email}). Não usamos um formulário público para isso, porque um pedido de retirada é pessoal e privado.`,
    removalComingSoon: (issueUrl) =>
      `Em breve haverá um endereço de e-mail privado para esses pedidos. Até lá, o mapa não mostra nenhum nome, e você pode fazer o pedido em uma [issue do GitHub](${issueUrl}). Qualquer pessoa pode ler uma issue do GitHub, então escreva só o número do memorial ou onde ele fica: você não precisa dar um nome, um motivo nem dizer quem você é.`,
  },

  language: {
    button: 'Idioma',
    buttonLabel: (name) => `Idioma: ${name}. Escolher outro idioma`,
    title: 'Idioma',
    intro: 'Escolha o idioma deste site. A página abre de novo nesse idioma, e este navegador lembra a sua escolha.',
    inUse: 'Em uso',
    notReady: 'Tradução em andamento',
    listLabel: 'Idiomas',
    aiNote: 'Traduzido com a ajuda de inteligência artificial e ainda não revisado por um falante nativo.',
    fixLink: 'Corrigir uma tradução',
    pageInEnglish: 'Esta página ainda não foi traduzida, por isso aparece em inglês.',
    offerLabel: 'Oferta de idioma',
  },

  units: {
    meters: (n) => `${formatNumber(n)} metros`,
    kilometers: (km) => `${formatDecimal(km, 1)} quilômetros`,
  },

  header: {
    settings: 'Configurações',
    share: 'Copiar link',
    shareDone: 'Link copiado. Quem abrir vai ver este mesmo mapa.',
    shareDoneNoMap: 'Link copiado. Ele não inclui onde o mapa está, porque o mapa está mostrando onde você está.',
    shareFailed: 'Não foi possível copiar o link. Copie o endereço direto do seu navegador.',
    dataStatus: 'Status dos dados',
  },

  nav: {
    menu: 'Menu',
    menuTitle: 'Menu do site',
    menuLabel: 'Páginas do site',
    map: 'Mapa',
    landBank: 'O Land Bank em números',
    pages: [
      { slug: 'about', label: 'Sobre' },
      { slug: 'why', label: 'Por que funciona' },
      { slug: 'how', label: 'Como fazer' },
      { slug: 'responsibly', label: 'Use com responsabilidade' },
      { slug: 'vacant-land', label: 'Como encontramos terrenos vazios' },
      { slug: 'streetcomplete', label: 'Verificar pontos de ônibus' },
      { slug: 'terms', label: 'Termos' },
      { slug: 'privacy', label: 'Privacidade' },
      { slug: 'contact', label: 'Contato' },
    ],
  },

  views: {
    groupLabel: 'Escolha uma visualização',
    field: 'Rua',
    analysis: 'Análise',
    fieldLong: 'Visualização de rua',
    analysisLong: 'Visualização de análise',
    fieldHint: 'Para quem está no quarteirão: lugares por perto e o primeiro passo legal.',
    analysisHint: 'Para organizadores: lentes, filtros, detalhes e uma lista em ordem de prioridade.',
    auto: 'Escolher uma visualização pelo tamanho da minha tela',
    autoHint: 'Celulares usam a visualização de rua; telas maiores usam a de análise.',
  },

  freshness: {
    checking: 'Verificando os dados',
    ok: (date) => `Dados de ${date}`,
    stale: 'Alguns dados estão desatualizados',
    failing: 'Alguns dados não estão carregando',
    unknown: 'Status dos dados desconhecido',
  },

  field: {
    nearMe: 'Perto de mim',
    nearMeBusy: 'Encontrando você',
    nearMeDenied: 'A localização está desativada para este site. Você ainda pode mover o mapa com a mão.',
    nearMeUnavailable: 'Seu aparelho não conseguiu encontrar a sua localização. Você ainda pode mover o mapa com a mão.',
    nearMeUnsupported: 'Este navegador não pode compartilhar a sua localização. Você ainda pode mover o mapa com a mão.',
    nearMeOutside: 'Você parece estar fora da Filadélfia. Este mapa cobre só a Filadélfia.',
    nearMePrivacy: 'Sua localização fica no seu aparelho. O Placekeepers nunca a envia a lugar nenhum e nunca a coloca em um link.',
    youAreHere: 'Você está aqui',
    stopLocation: 'Parar de usar a minha localização',
    locationInUse: 'Usando a sua localização. Ela fica neste aparelho e fora de qualquer link que você copiar.',
    stop: 'Parar',
    myLists: 'Minhas listas',
    listsTitle: 'Listas salvas',
    chipsLabel: 'Camadas principais',
    moreLayers: 'Mais camadas',
    layersTitle: 'Camadas',
  },

  chips: {
    lots: 'Lotes',
    streets: 'Ruas',
    memorials: 'Memoriais',
    stops: 'Pontos de ônibus',
    comingSoon: 'em breve',
  },

  sheet: {
    title: 'O que você pode fazer por perto',
    show: 'Mostrar lugares por perto',
    hide: 'Ocultar lugares por perto',
    countLabel: (n) => pl(n, '# lugar', '# lugares'),
    zoomIn: 'Mova o mapa ou aproxime até um bairro para ver os lugares por perto.',
    finding: 'Procurando os lugares por perto.',
    noLotsLayer: 'Ative a camada Lotes ou Pontos de ônibus para ver os lugares por perto.',
    nothingHere: 'Nenhum lote ou prédio vazio corresponde às suas configurações nesta parte do mapa.',
    nothingHereStops: 'Nenhum lote vazio, prédio vazio ou ponto de ônibus corresponde às suas configurações nesta parte do mapa.',
    noStopsHere: 'Nenhum ponto de ônibus ou de bonde corresponde às suas configurações nesta parte do mapa.',
    showOnMap: 'Mostrar no mapa',
    openLotPage: 'Abrir a página do lote',
    nearestToYou: 'Os mais próximos de você primeiro.',
    nearestToCenter: 'Os mais próximos do meio do mapa primeiro. Mova o mapa ou toque em Perto de mim.',
    noneWithSuggestion: 'Nenhum lugar aqui tem uma sugestão ativada. Ative sugestões em Configurações ou mova o mapa.',
    showMore: 'Mostrar mais lugares',
    distance: (meters, fromYou) => {
      const feet = meters * 3.28084;
      const far = feet < 1000 ? `${formatNumber(Math.max(10, Math.round(feet / 10) * 10))} pés` : `${formatDecimal(feet / 5280, 1)} milhas`;
      return `A cerca de ${far} ${fromYou ? 'de você' : 'do meio do mapa'}`;
    },
  },

  place: {
    kindLot: 'Lote vazio',
    kindBuilding: 'Prédio vazio',
    kindUnknown: 'Imóvel vazio',
    parcel: (id) => `Lote ${id}`,
    priority: (score, lens) => `Prioridade ${score} de 100 para ${lens.toLowerCase()}`,
    mainReason: (label) => `Motivo principal: ${label}.`,
    bestSuggestion: 'O que você poderia fazer',
    firstStep: 'Primeiro passo legal',
    cost: (cost) => `Custo: ${cost}`,
    confidence: { 1: 'Não temos muita certeza de que está vazio', 2: 'Provavelmente vazio', 3: 'Muito provavelmente vazio' },
    confidenceTitle: 'Quanta certeza temos',
    ownerTitle: 'Tipo de proprietário',
    landcare: 'Já mantido pelo PHS LandCare',
    listed: 'Consta como disponível na lista dos órgãos de terras da Prefeitura',
    suggestionsTitle: 'Sugestões',
    clearSelection: 'Limpar a seleção',
    selectedTitle: 'Lugar selecionado',
  },

  ownerTypes: {
    0: 'Desconhecido',
    1: 'Pessoa física',
    2: 'Empresa',
    3: 'Prefeitura da Filadélfia',
    4: 'Land Bank da Filadélfia',
    5: 'Autoridade de Redesenvolvimento',
    6: 'Autoridade de habitação',
    7: 'Sem fins lucrativos',
    8: 'Outro órgão público',
  },

  why: {
    title: 'Por que esta pontuação',
    caption: 'O valor de cada fator de 0 a 100, o seu peso e os pontos que ele soma à pontuação',
    intro: 'A pontuação é uma média ponderada destes fatores. Cada um vai de 0 a 100, e 100 significa a maior necessidade.',
    factor: 'Fator',
    value: 'De 100',
    weight: 'Peso',
    adds: 'Soma',
    noData: 'sem dados',
    off: 'desligado',
    total: 'Pontuação',
    missingNote: 'Fatores sem dados para este lugar ficam fora da média dele.',
  },

  reasons: {
    title: 'Por que achamos que está vazio',
    againstTitle: 'O que nos faz hesitar',
    notPublished: 'Os motivos para este lugar ainda não foram publicados.',
    city_land: (date) =>
      date ? `A Prefeitura lista como provável terreno vazio (lista de ${date})` : 'A Prefeitura lista como provável terreno vazio',
    city_building: (date) =>
      date
        ? `A Prefeitura lista como provável prédio vazio (lista de ${date})`
        : 'A Prefeitura lista como provável prédio vazio',
    assessor_vacant_land: 'A avaliação de imóveis da Prefeitura (OPA) classifica como terreno vazio',
    no_building: 'Não há nenhum prédio no lote',
    demolished: (year) =>
      year ? `Demolido em ${year}, sem nada construído desde então` : 'Demolido, sem nada construído desde então',
    vacant_lot_record: 'O L&I registrou uma infração ou reclamação de lote vazio nos últimos dois anos',
    landcare: 'Está no PHS LandCare, que cuida de lotes vazios',
    sealed: (year) =>
      year ? `Lacrado pela Prefeitura em ${year}, sem nenhum alvará emitido desde então` : 'Lacrado pela Prefeitura, sem nenhum alvará emitido desde então',
    unsafe: 'O L&I lista como inseguro, sem nenhum alvará emitido desde então',
    imminently_dangerous: 'O L&I declarou perigo iminente, sem nenhum alvará emitido desde então',
    vacant_building_record: 'O L&I registrou uma infração ou reclamação de imóvel vazio nos últimos dois anos',
    assessor_exterior: 'A avaliação de imóveis anotou que o exterior está vazio ou lacrado',
    built_since: (year) =>
      year
        ? `Um novo alvará de construção foi emitido em ${year}, então pode haver um prédio ali agora`
        : 'Um novo alvará de construção foi emitido, então pode haver um prédio ali agora',
    construction_starting: (year) =>
      year
        ? `Um novo alvará de construção foi emitido em ${year}, então uma obra pode estar começando`
        : 'Um novo alvará de construção foi emitido, então uma obra pode estar começando',
    side_yard: 'O mesmo proprietário da casa habitada ao lado também possui este lote, então pode ser um quintal lateral',
    land_use_shows_use: 'O mapa de uso do solo da Prefeitura mostra que está em uso',
    recent_permit: 'Um alvará de obra ou de zoneamento foi emitido nos últimos dois anos',
    building_stands: 'Há o contorno de um prédio sobre ele, embora os registros digam terreno vazio',
    homestead: 'O proprietário tem a isenção Homestead: os registros da Prefeitura dizem que alguém mora aqui, ou morava',
  },

  lens: {
    title: 'Lente',
    presets: 'Predefinições',
    presetActive: 'em uso',
    weightLabel: (factor) => `Peso de ${factor}`,
    weightValue: (w) => (w === 0 ? 'Desligado' : `${w} de 5`),
    resetWeights: 'Redefinir os pesos',
    allOff: 'Todos os fatores estão desligados. Ligue um para colorir os lotes.',
    allOffFor: (appliesTo) =>
      appliesTo === 'segment'
        ? 'Todos os fatores estão desligados. Ligue um para colorir as ruas.'
        : appliesTo === 'stop'
          ? 'Todos os fatores estão desligados. Ligue um para colorir os pontos de ônibus e de bonde.'
          : 'Todos os fatores estão desligados. Ligue um para colorir os lotes.',
    explainToggle: 'Por que este fator',
    shown: (layer, lens) => `Mostrando agora "${layer}", colorido pela lente de ${lens.toLowerCase()}.`,
    notShown: (layer) => `O mapa não está mostrando esta lente em "${layer}" agora.`,
    showOnMap: 'Mostrar no mapa',
    legendLow: 'Prioridade menor',
    legendHigh: 'Prioridade maior',
    legendNoData: 'Sem pontuação',
  },

  filters: {
    title: 'Filtros',
    intro:
      'Escolha opções para reduzir os lotes no mapa, na lista em ordem de prioridade e no gráfico. Um grupo sem nenhuma opção escolhida mostra tudo.',
    ownerType: 'Tipo de proprietário',
    landcare: 'Já no LandCare',
    inLandcare: 'Mantido pelo PHS LandCare',
    notInLandcare: 'Fora do LandCare',
    confidence: 'Quanta certeza temos',
    kind: 'Lote ou prédio',
    listed: 'Listados pelos órgãos de terras da Prefeitura',
    clear: 'Limpar os filtros',
    showAll: 'Mostrar tudo',
    noneSelected: (group) => `Nada está escolhido em "${group}", então nenhum lote é mostrado.`,
    narrowedNote: (n) =>
      n === 1
        ? 'Um filtro da visualização de análise está reduzindo estes lugares.'
        : `${formatNumber(n)} filtros da visualização de análise estão reduzindo estes lugares.`,
  },

  permission: {
    title: 'Primeiro passo para obter permissão',
    short: {
      0: 'Ainda sem caminho claro',
      1: 'Community LandCare',
      2: 'Acordo ou licença de jardim',
      3: 'Pergunte à PHDC',
      4: 'Pergunte ao órgão público',
      5: 'Pergunte ao proprietário',
    },
    long: {
      0: 'Ainda sem caminho claro: os registros da Prefeitura não trazem o nome do proprietário',
      1: 'O PHS LandCare já cuida do lote: gestão pelo Community LandCare',
      2: 'A Prefeitura ou o Land Bank possui o lote: um acordo ou licença de jardim',
      3: 'A Autoridade de Redesenvolvimento ou a PHDC possui o lote: pergunte à PHDC',
      4: 'A autoridade de habitação ou outro órgão público possui o lote: pergunte ao órgão',
      5: 'Um proprietário particular: pergunte ao proprietário',
    },
    notPublished: 'Ainda não publicado',
    filterHelp:
      'A quem pedir primeiro, a partir do proprietário que os registros da Prefeitura indicam. É um tipo de passo, não uma medida da chance de alguém dizer sim.',
    noRoute: 'Ainda sem caminho claro: os registros da Prefeitura não trazem o nome do proprietário. A página do lote mostra o que sabemos.',
    seeLotPage: 'A página do lote lista os caminhos legais para este lugar.',
  },

  layers: {
    title: 'Camadas',
    show: (label) => `Mostrar ${label}`,
    details: 'Sobre esta camada',
    settings: 'Configurações da camada',
    sources: 'Fontes',
    legend: 'Legenda',
    license: 'Licença',
    noData: 'Ainda sem dados publicados',
    dataError: 'Não foi possível carregar esta camada.',
    resetAll: 'Voltar aos valores iniciais',
    resetDone: 'As configurações voltaram aos valores iniciais.',
    guide: 'Como você pode ajudar a melhorar esta camada',
  },

  settings: {
    title: 'Configurações',
    intro:
      'Tudo no mapa é uma configuração. Suas escolhas ficam salvas neste navegador e no link, menos as de privacidade, que ficam só neste navegador.',
    viewTitle: 'Visualização',
    layersTitle: 'Camadas e suas configurações',
    lensTitle: 'Pesos das lentes',
    suggestionsTitle: 'Sugestões a mostrar',
    suggestionShow: (label) => `Mostrar "${label}"`,
    resetTitle: 'Começar de novo',
    resetHelp: 'Volta cada camada, configuração e peso aos valores iniciais desta visualização e esquece a cópia salva neste navegador.',
    reset: 'Voltar aos valores iniciais',
    storageNote: 'Salvo só neste navegador. O Placekeepers não tem contas, cookies nem rastreamento.',
  },

  analysis: {
    leftTitle: 'Lente, filtros e camadas',
    rightTitle: 'Detalhes',
    openLeft: 'Lente e camadas',
    openRight: 'Detalhes',
    closePanel: 'Fechar o painel',
    areaTitle: 'Nesta parte do mapa',
    areaLots: (n) => pl(n, '# lote vazio', '# lotes vazios'),
    areaBuildings: (n) => pl(n, '# prédio vazio', '# prédios vazios'),
    areaHigh: (n) => `${formatNumber(n)} deles muito provavelmente vazios`,
    areaLandcare: (n) => `${formatNumber(n)} já mantidos pelo PHS LandCare`,
    areaEmpty: 'Nenhum lote ou prédio vazio corresponde às suas configurações aqui. Tente afastar o mapa ou mudar os filtros.',
    areaHint: 'Selecione um lote no mapa ou na lista para ver por que ele tem esta pontuação.',
    sampleArea:
      'Com o mapa afastado assim, ele mostra só uma amostra dos lotes e prédios vazios, então eles não são contados aqui. Aproxime para contar todos os lugares.',
    sampleList:
      'Aproxime para listar todos os lugares. Com o mapa afastado assim, ele mostra só uma amostra dos lotes e prédios vazios, então uma lista ou um gráfico aqui deixaria lugares de fora.',
    sampleTab: 'aproxime',
    tableCaption: 'Lugares à vista, em ordem pela combinação de lentes atual',
    rank: 'Posição',
    place: 'Lugar',
    score: 'Pontuação',
    reason: 'Motivo principal',
    save: 'Salvar',
    sortHighFirst: 'Maior pontuação primeiro. Escolha para pôr a menor primeiro.',
    sortLowFirst: 'Menor pontuação primeiro. Escolha para pôr a maior primeiro.',
    tableEmpty: 'Nada para ordenar à vista.',
    noScores: 'As pontuações de prioridade ainda não foram publicadas, então esta lista está na ordem do número do lote.',
    tableMore: (shown, total) =>
      `Mostrando os primeiros ${formatNumber(shown)} de ${formatNumber(total)}. Aproxime ou reduza os filtros para ver o resto, ou baixe todos.`,
    drawerLabel: 'Lugares à vista',
    tabTable: 'Lista em ordem',
    tabPlot: 'Necessidade e primeiro passo',
    tabLists: 'Listas salvas',
    tabMemorials: 'Memoriais',
    tabBlocks: 'Quarteirões de rua',
  },

  plot: {
    title: 'Necessidade e primeiro passo para obter permissão',
    intro:
      'Cada ponto é um lugar à vista. Na horizontal: a prioridade dele na sua combinação de lentes, de 0 a 100. Na vertical: o primeiro passo para obter permissão, um tipo de passo, não uma medida da chance de alguém dizer sim. Escolha um ponto para abrir a página do lote.',
    axisX: 'Prioridade na sua combinação de lentes',
    empty: 'Nenhum lugar à vista para mostrar no gráfico.',
    noScore: (n) => `${pl(n, '# lugar não tem pontuação e não aparece', '# lugares não têm pontuação e não aparecem')}.`,
    noStep: (n) =>
      `${pl(n, '# lugar ainda não tem primeiro passo publicado e não aparece', '# lugares ainda não têm primeiro passo publicado e não aparecem')}.`,
    dot: (place, score, step) => `${place}: prioridade ${score}. ${step}.`,
    tableNote: 'A lista em ordem mostra os mesmos lugares, com o mesmo primeiro passo, para teclados e leitores de tela.',
    capped: (shown, total) =>
      `Mostrando os ${formatNumber(shown)} lugares com as maiores pontuações, de ${formatNumber(total)} à vista. Aproxime para ver todos.`,
    summary: (rows) => `Lugares à vista pelo primeiro passo para obter permissão: ${rows}.`,
    rowSummary: (label, n) => `${label}, ${pl(n, '# lugar', '# lugares')}`,
  },

  export: {
    title: 'Baixar estes lugares',
    help: (limit) =>
      `Um arquivo com até ${formatNumber(limit)} lugares e o que a página de cada lote diz sobre o proprietário, incluindo as sinalizações sobre o proprietário. A primeira linha aponta para os termos de uso.`,
    csv: 'Baixar CSV',
    geojson: 'Baixar GeoJSON',
    inView: 'Lugares à vista',
    working: (done, total) => `Reunindo os detalhes dos proprietários: ${formatNumber(done)} de ${formatNumber(total)} arquivos`,
    done: (n) => `Baixados: ${pl(n, '# lugar', '# lugares')}.`,
    leftOut: (n, limit) =>
      `${pl(n, '# lugar a mais ficou', '# lugares a mais ficaram')} de fora, porque um arquivo comporta no máximo ${formatNumber(limit)}. Aproxime ou reduza os filtros para baixar o resto.`,
    withoutDetails: (n) =>
      n === 1
        ? `${pl(n, '# lugar não tem', '# lugares não têm')} detalhes publicados, então as colunas de proprietário dele ficam vazias.`
        : `${pl(n, '# lugar não tem', '# lugares não têm')} detalhes publicados, então as colunas de proprietário deles ficam vazias.`,
    nothing: 'Não há lugares para baixar.',
    sampleOff: 'O arquivo traz todos os lugares à vista, e com o mapa afastado assim ele mostra só uma amostra. Aproxime para baixar.',
    failed: 'Não foi possível gerar o arquivo. Tente de novo daqui a pouco.',
    yes: 'sim',
    no: 'não',
    termsLine: (url) => `Exportação do Placekeepers: só para o cuidado da comunidade e para ações dentro da lei. Leia antes os termos de uso: ${url}`,
    englishColumns: 'Os nomes das colunas estão em inglês em todos os idiomas para que os arquivos possam ser combinados e lidos de novo.',
    madeLine: (n, title, day, dataDay) =>
      `${pl(n, '# lugar', '# lugares')} de ${title}. Gerado em ${day}${dataDay ? ` a partir dos dados semanais de ${dataDay}` : ''}.`,
    ownerLine:
      'Os nomes e endereços de correspondência dos proprietários estão como a Prefeitura os publica. Toda sinalização sobre o proprietário tem uma nota de cuidado e um próximo passo de proteção: leia-os na página do lote antes de agir. Não é aconselhamento jurídico.',
    scoreLine: (lens, weights) => `As pontuações usam a lente de ${lens.toLowerCase()} com estes pesos: ${weights}.`,
    greeningLine: (caution) => `Sobre as sugestões de áreas verdes: ${caution}`,
    placemakingLine: (caution) => `Sobre jardins, bancos e arte: ${caution}`,
  },

  lists: {
    title: 'Listas salvas',
    privacy:
      'As listas ficam neste navegador, neste aparelho. Nada é enviado a lugar nenhum. Para levar uma lista a outro aparelho ou compartilhá-la, baixe-a como arquivo e abra esse arquivo lá.',
    notKept:
      'Este navegador não está guardando listas agora, talvez por ser uma janela privada ou por ter o armazenamento bloqueado. Baixe a sua lista antes de fechar a página.',
    empty: 'Ainda não há listas. Salve um lugar a partir do cartão dele, da lista em ordem ou da página do lote, e uma lista começa.',
    inUse: 'Lista em uso',
    defaultName: 'Minha lista',
    untitled: 'Lista',
    newList: 'Nova lista',
    newName: 'Nome da nova lista',
    create: 'Criar a lista',
    rename: 'Renomear',
    renameLabel: 'Novo nome para esta lista',
    saveName: 'Salvar o nome',
    cancel: 'Cancelar',
    delete: 'Excluir esta lista',
    made: (name) => `Lista "${name}" criada. Os lugares que você salvar agora vão para ela.`,
    renamed: (name) => `A lista agora se chama "${name}".`,
    deleted: (name) => `"${name}" excluída deste navegador.`,
    confirmDelete: (name, n) =>
      `Excluir "${name}" e ${pl(n, 'o seu # lugar', 'os seus # lugares')} deste navegador? Não dá para recuperar, a menos que você tenha baixado a lista.`,
    count: (n) => pl(n, '# lugar', '# lugares'),
    noPlaces: 'Esta lista está vazia. Salve lugares a partir dos cartões, da lista em ordem ou das páginas dos lotes.',
    open: (place) => `Abrir a página do lote de ${place}`,
    remove: 'Remover',
    removeLabel: (place) => `Remover ${place} da lista`,
    save: 'Salvar na minha lista',
    saveShort: 'Salvar',
    savedShort: 'Salvo',
    saveShortLabel: (place, list) => `Salvar ${place} em ${list}`,
    saveTo: (name) => `Salvar em ${name}`,
    saved: (name) => `Salvo em ${name}`,
    savedLabel: (name) => `Salvo em ${name}. Escolha para remover.`,
    added: (name) => `Salvo em "${name}". As listas ficam neste navegador.`,
    removed: (name) => `Removido de "${name}".`,
    full: (limit) => `Esta lista está cheia: uma lista comporta até ${formatNumber(limit)} lugares.`,
    tooMany: (limit) => `Este navegador guarda até ${formatNumber(limit)} listas. Exclua uma para criar outra.`,
    download: 'Baixar esta lista',
    importTitle: 'Abrir um arquivo de lista',
    importHelp: 'Um arquivo CSV ou GeoJSON baixado do Placekeepers, ou qualquer arquivo de texto com números de lote de nove dígitos.',
    imported: (name, n) => `"${name}" aberta com ${pl(n, '# lugar', '# lugares')}.`,
    importFailed: 'Esse arquivo não tem números de lote que possamos ler.',
    importTooBig: 'Esse arquivo é grande demais para ser uma lista.',
    importLeftOut: (n, limit) => `${pl(n, '# lugar ficou', '# lugares ficaram')} de fora: uma lista comporta até ${formatNumber(limit)}.`,
  },

  displacement: {
    caution: 'Criar áreas verdes pode aumentar os preços na vizinhança. Considere combinar isso com proteções.',
    placemakingCaution:
      'Novos jardins, bancos para sentar e arte podem tornar um quarteirão mais procurado e aumentar os preços e os aluguéis na vizinhança. Combine-os com proteções para os vizinhos que pagam aluguel ou que estão com impostos atrasados.',
    protections: 'Formas de proteger os vizinhos',
    inWatch: (signs) =>
      `Este lugar está em uma área em observação de deslocamento de moradores, com sinais de que os preços estão subindo aqui: ${signs}.`,
    protectionsTitle: 'Proteções para combinar com isso',
    jumpToWatch: 'Ver os sinais daqui e as formas de proteger os vizinhos',
    jumpToProtections: 'Ver as formas de proteger os vizinhos',
    listIntro:
      'Alguns destes lugares estão em áreas em observação de deslocamento de moradores, com sinais nos registros públicos de que os preços estão subindo ali. O cartão de cada um nomeia os sinais da sua área.',
    printSeeAbove: 'Veja "Observação de deslocamento de moradores" acima.',
    protectionLabels: {
      neighborhood_gardens_trust: 'Neighborhood Gardens Trust',
      community_land_trust: 'Fundos de terra comunitários (community land trusts)',
      homestead_exemption: 'A isenção Homestead da Prefeitura',
      longtime_owner_occupants: 'O Programa de Ocupantes Proprietários de Longa Duração (LOOP) da Prefeitura',
      tangled_title_help: 'Ajuda com um título embaraçado',
    },
    checked: (date) => `verificado em ${date}`,
    signShort: {
      prices: 'preços de casas subindo mais rápido do que na cidade toda',
      assessments: 'valores avaliados pela Prefeitura subindo mais rápido do que na cidade toda',
      mva: 'a Market Value Analysis da Prefeitura mostrando preços de casas subindo além do alcance de quem mora aqui há muito tempo',
      companies: 'empresas comprando muitas das casas vendidas',
      renters: 'pelo menos três em cada cinco casas alugadas',
      rent_burden: 'muitos inquilinos pagando metade da renda ou mais em aluguel',
    },
    heading: 'Sinais de que os preços estão subindo aqui',
    areaTitle: (tract) => `Setor censitário ${tract}`,
    around: (place) => `Em volta de ${place}`,
    signsHere: 'Sinais aqui',
    alsoMeasured: 'Também medido, mas não é um sinal aqui',
    signTitle: {
      prices: 'Preços de venda das casas',
      assessments: 'Valores avaliados pela Prefeitura',
      mva: 'A Market Value Analysis da Prefeitura',
      companies: 'Compradores que são empresas',
      renters: 'Inquilinos',
      rent_burden: 'Inquilinos que pagam metade da renda ou mais em aluguel',
    },
    span: (a0, a1, b0, b1) => `vendas de ${a0} a ${a1} e de ${b0} a ${b1}`,
    pricesText: (p0, p1, change, city, span) =>
      `O preço mediano das casas vendidas passou de ${p0} para ${p1}, ${rise(change)}${city === null ? '' : `, contra ${rise(city)} na cidade toda`}${span ? ` (${span})` : ''}.`,
    companiesText: (share, sales, city) =>
      `Empresas compraram ${share}% das ${formatNumber(sales)} casas vendidas nos últimos três anos${city === null ? '' : `, contra ${city}% na cidade toda`}.`,
    assessmentsText: (change, homes, city, years) =>
      `O valor de mercado da casa mediana, segundo a Prefeitura, ${went(change)}${years ? ` de ${years[0]} a ${years[1]}` : ''} (${pl(homes, '# casa', '# casas')})${city === null ? '' : `, contra ${rise(city)} na cidade toda`}.`,
    rentersText: (share, city, years) =>
      `${share}% das casas onde as pessoas moram aqui são alugadas${city === null ? '' : `, contra ${city}% na cidade toda`}${years ? ` (pesquisa do Departamento do Censo dos EUA, de ${years[0]} a ${years[1]})` : ''}.`,
    mvaText: (rising, groups, edition) =>
      rising > 0
        ? `Em ${rising} dos ${pl(groups, '# grupo de quarteirões', '# grupos de quarteirões')} daqui, a ${edition ?? 'Market Value Analysis'} do Reinvestment Fund para a Prefeitura encontra pressão crescente: preços de casas subindo além do alcance do que ganha quem mora aqui há muito tempo.`
        : `Em nenhum dos ${pl(groups, '# grupo de quarteirões', '# grupos de quarteirões')} daqui a ${edition ?? 'Market Value Analysis'} encontra pressão crescente.`,
    mvaNone: 'A Market Value Analysis não cobre esta área.',
    tooFewSales: (earlier, recent, needed) =>
      `Poucas vendas de casas para saber (${formatNumber(earlier)} e ${formatNumber(recent)}; são necessárias pelo menos ${formatNumber(needed)} em cada período).`,
    tooFewHomes: 'Poucas casas com valores nos dois anos para saber.',
    tooFewHouseholds: 'Poucos domicílios na pesquisa do Censo para saber.',
    rule: 'Uma área entra na observação quando pelo menos dois destes sinais se confirmam, e pelo menos um deles é sobre preços: preços de venda, valores avaliados ou a Market Value Analysis.',
    meaning: 'Criar áreas verdes e outras melhorias aqui pode aumentar ainda mais os preços. Combine-as com proteções para os vizinhos que moram aqui agora.',
    cannotTell:
      'São sinais em registros públicos, não uma previsão. Eles não mostram quem se mudou nem por quê, nem quem mora aqui; os números da pesquisa do Censo são médias de cinco anos, então não mostram quanto custam os aluguéis hoje. Uma área fora da observação ainda pode sentir os preços subindo.',
    contextTitle: 'Aluguéis, rendas e casas vazias aqui',
    contextIntro: (years) =>
      `Da pesquisa do Departamento do Censo dos EUA${years ? `, de ${years[0]} a ${years[1]}` : ''}. Contexto para os vizinhos, não um sinal: estes números não mudam nenhuma área.`,
    contextNoisy:
      'São estimativas de uma pesquisa com algumas casas ao longo de cinco anos, então em uma área pequena elas são aproximadas: o número verdadeiro provavelmente está dentro da margem mostrada (a margem de erro do Departamento do Censo, com 90 por cento de confiança).',
    contextTitles: {
      rent: 'Aluguel mediano',
      income: 'Renda mediana das famílias',
      vacant: 'Casas vazias',
    },
    burdenText: (share, margin, households, city, years) =>
      `${share}% dos ${formatNumber(households)} domicílios de inquilinos daqui pagam metade da renda ou mais em aluguel e contas de água, luz e gás${margemDeErro(margin, 'points')}${city === null ? '' : `, contra ${city}% na cidade toda`}${years ? ` (pesquisa do Departamento do Censo dos EUA, de ${years[0]} a ${years[1]})` : ''}. Os aluguéis em alta pesam mais para eles.`,
    burdenTooFew: 'Poucos domicílios de inquilinos na pesquisa do Censo para saber.',
    rentText: (rent, margin, city) =>
      `${rent} por mês, com as contas que o inquilino paga${margin ? ` (margem de erro de ${margin})` : ''}${city ? `, contra ${city} na cidade toda` : ''}.`,
    rentNone: 'A pesquisa do Censo tem poucas respostas aqui para um aluguel mediano.',
    incomeText: (income, margin, city) =>
      `${income} por ano${margin ? ` (margem de erro de ${margin})` : ''}${city ? `, contra ${city} na cidade toda` : ''}.`,
    incomeNone: 'A pesquisa do Censo tem poucas respostas aqui para uma renda mediana.',
    vacantText: (vacant, homes, share, margin, city) =>
      `${formatNumber(vacant)} das ${formatNumber(homes)} casas daqui, ${share}%${margemDeErro(margin, 'points')}${city === null ? '' : `, contra ${city}% na cidade toda`}.`,
    vacantTooFew: 'Poucas casas na pesquisa do Censo para saber.',
    whyEmpty: 'Por que estão vazias',
    whyRows: {
      vr: 'Para alugar',
      vs: 'À venda',
      vn: 'Alugada ou vendida, ainda sem ninguém morando',
      vz: 'Para uso sazonal ou ocasional',
      vo: 'Fora do mercado por outros motivos, como reformas, problemas legais de uma família ou abandono',
    },
    whyRow: (label, n, margin) => `${label}: ${formatNumber(n)}${margemDeErro(margin, 'homes')}`,
    legendArea: 'Uma área com sinais de que os preços estão subindo',
    legendTap: 'Toque dentro de uma área, ou bem perto da borda, para ver os sinais dela.',
    legendNote:
      'Sinais em registros públicos, não uma previsão. Os cartões de áreas verdes, jardins, bancos e arte nestas áreas acrescentam formas de proteger os vizinhos.',
    exportColumn: (signs) => `Área em observação de deslocamento de moradores: ${signs}`,
    exportLine: (caution, links) =>
      `Sobre criar áreas verdes em áreas em observação de deslocamento de moradores: ${caution} Formas de proteger os vizinhos: ${links}`,
    placemakingExportLine: (caution, links) =>
      `Sobre jardins, bancos e arte em áreas em observação de deslocamento de moradores: ${caution} Formas de proteger os vizinhos: ${links}`,
    watchTitle: 'Observação de deslocamento de moradores',
  },

  evidence: {
    strong: { label: 'Evidência forte', meaning: 'Um ensaio randomizado, de preferência na Filadélfia, encontrou o efeito.' },
    moderate: {
      label: 'Evidência moderada',
      meaning: 'Comparações cuidadosas de antes e depois, com áreas de controle, encontraram o efeito.',
    },
    mixed: { label: 'Evidência mista', meaning: 'Bons estudos discordam, ou o efeito depende do contexto.' },
    weak: { label: 'Evidência fraca', meaning: 'Só pesquisas de percepção ou correlações, ou um único estudo pequeno.' },
    not_violence: {
      label: 'Não se trata de violência',
      meaning: 'Valioso por outros motivos. Nenhuma afirmação é feita sobre violência.',
    },
    context: {
      label: 'Contexto',
      meaning: 'Informação de fundo que mostra onde o cuidado pode ajudar mais. Não é uma afirmação sobre o que funciona.',
    },
  },

  legend: {
    parcelsFill: 'Cor de preenchimento: prioridade na sua combinação de lentes',
    parcelsFillLens: (lens) => `Cor de preenchimento: prioridade na lente de ${lens.toLowerCase()}`,
    parcelsSure: 'Contorno: quanta certeza temos de que está vazio',
    sureHigh: 'Muito provavelmente vazio',
    sureMedium: 'Provavelmente vazio',
    sureLow: 'Pouca certeza',
    parcelPoint: 'Pontos: com o mapa afastado, uma amostra dos lotes vazios; de perto, um lote sem forma mapeada',
    parcelsListed:
      'Mostrando só os lotes que os órgãos de terras da Prefeitura listam como disponíveis. Um lote que o mapa não chama de vazio não é desenhado; o mapa do próprio Land Bank mostra todos.',
    selected: 'Lugar selecionado',
    landcare: 'Lote mantido pelo PHS LandCare: já tem cuidado',
    garden: 'Jardim comunitário ou horta urbana',
    hin: 'Rua na Rede de Lesões Graves',
    hexIntro: (window) => `Pessoas baleadas, por hexágono: ${window.toLowerCase()}`,
    hexNone: 'Hexágonos sem pessoas baleadas ficam sem cor.',
    countBin: (lo, hi) => (hi === null ? `${formatNumber(lo)} ou mais` : lo === hi ? formatNumber(lo) : `${formatNumber(lo)} a ${formatNumber(hi)}`),
    segmentsFill: 'Cor da linha: pontuação de segurança da rua na sua combinação de lentes',
    segmentsShown: (min) =>
      min <= 1
        ? 'Todo quarteirão com pontuação acima de zero é mostrado.'
        : `Quarteirões com pontuação de ${formatNumber(min)} ou mais em 100 são mostrados.`,
    segmentsZoom:
      'Com o mapa afastado, só são desenhados os quarteirões com danos registrados ou na Rede de Lesões Graves. Aproxime para ver o resto.',
    crashSeverity: {
      3: 'Alguém morreu',
      2: 'Alguém ficou gravemente ferido',
      1: 'Alguém ficou ferido',
      0: 'Ninguém foi registrado como ferido',
    },
    crashesZoom: 'Aproxime para ver as colisões em que ninguém ficou gravemente ferido.',
    crashesSource: 'Dos registros de colisões do PennDOT, que chegam cerca de um ano depois das colisões.',
    memorial: 'Uma pessoa que morreu ao caminhar, andar de bicicleta ou de patinete',
    memorialEveryone: 'Uma pessoa que morreu em uma colisão de trânsito',
    memorialNames: 'Um anel mais cheio significa que uma lista pública de memoriais compartilha o nome da pessoa. Abra o marcador para ler.',
    memorialNamesWaiting:
      'Nenhum nome é mostrado ainda. Eles só vão aparecer quando as famílias tiverem uma forma privada de pedir que um seja retirado.',
    memorialNamesHidden: 'Os nomes estão ocultos.',
    stopShelter: 'Um abrigo, ou o ponto inteiro está debaixo de um teto',
    stopBench: 'Um banco, mas nenhum abrigo mapeado',
    stopNeither: 'Sem abrigo e sem banco',
    stopUnknown: 'Ainda não verificado: o OpenStreetMap ainda não informa',
    stopSurvey: 'Como verificar um ponto com o StreetComplete',
    stopsCoverage: 'Só aparecem aqui os pontos que alguém adicionou ao OpenStreetMap, então muitos pontos ainda não são mostrados.',
    stopSurveyRoute: 'Imprimir uma ficha de verificação para uma linha inteira',
  },

  streets: {
    popupLabel: 'Sobre este lugar no mapa',
    detailsTitle: (style) =>
      style === 'memorials'
        ? 'Memorial'
        : style === 'crashes'
          ? 'Colisão'
          : style === 'street_segments'
            ? 'Quarteirão de rua'
            : style === 'transit_stops'
              ? 'Ponto'
              : style === 'transit_routes'
                ? 'Linha'
                : style === 'stop_amenities'
                  ? 'Abrigo e banco'
                  : style === 'city_trees'
                    ? 'Árvore'
                    : style === 'amenity'
                      ? 'Como está mapeado no OpenStreetMap'
                      : style === 'public_place'
                        ? 'Lugar'
                        : style === 'condition'
                          ? 'Informado ao 311'
                          : style === 'public_art'
                            ? 'Arte pública'
                            : style === 'traffic_stress'
                              ? 'Estresse do tráfego para bicicletas'
                              : style === 'parking_reports'
                                ? 'Problemas de estacionamento informados'
                                : style === 'city_shelters'
                                  ? 'Abrigo de ônibus'
                                  : style === 'street_poles'
                                    ? 'Poste de rua'
                                    : style === 'traffic_calming'
                                      ? 'Moderação de tráfego'
                                      : style === 'crossing_guards'
                                        ? 'Guarda de travessia escolar'
                                        : style === 'redlining'
                                          ? 'Mapa de redlining de 1937'
                                          : 'Detalhes',
    memorialTitle: 'Em memória',
    peopleHere: (n) => `${pl(n, '# pessoa é lembrada', '# pessoas são lembradas')} aqui`,
    killed: {
      walk: 'Morreu ao caminhar',
      bike: 'Morreu ao andar de bicicleta',
      scooter: 'Morreu ao andar de patinete',
      motorcycle: 'Morreu ao andar de moto',
      other: 'Morreu em uma colisão de trânsito',
    },
    killedOn: (what, date) => `${what} em ${date}.`,
    memorialSource: 'Ler o memorial público',
    blessing: 'Só com a bênção da família.',
    families: 'O Families for Safe Streets apoia as famílias depois de uma colisão.',
    canDo: 'O que os vizinhos podem fazer aqui',
    firstStep: 'Primeiro passo',
    cost: (cost) => `Custo: ${cost}`,
    memorialsNearby: 'Memoriais por perto',
    memorialsInView: 'Memoriais à vista',
    memorialsIntro: 'Cada um lembra uma pessoa que morreu em uma colisão de trânsito. Abra um para ler mais.',
    memorialCount: (n) => pl(n, '# memorial', '# memoriais'),
    memorialsMore: (n) => `${pl(n, '# memorial a mais está', '# memoriais a mais estão')} à vista. Aproxime para listá-los aqui.`,
    memorialsLayerOff: 'Ative a camada Memoriais para listar os memoriais à vista.',
    memorialsNone: 'Nenhum memorial nesta parte do mapa.',
    blocksNearby: 'Quarteirões de rua por perto',
    blocksInView: 'Quarteirões de rua à vista',
    blocksIntro: 'Cada quarteirão desenhado no mapa, com a sua prioridade de segurança da rua e o motivo principal. Abra um para ler por quê.',
    blockCount: (n) => pl(n, '# quarteirão', '# quarteirões'),
    blockNoScore: 'Sem pontuação de segurança da rua.',
    blocksMore: (n) => `${pl(n, '# quarteirão a mais está', '# quarteirões a mais estão')} à vista. Aproxime para listá-los aqui.`,
    blocksLayerOff: (layer) => `Ative a camada "${layer}" para listar os quarteirões de rua à vista.`,
    blocksNone: 'Nenhum quarteirão de rua é desenhado nesta parte do mapa.',
    crashesNearby: 'Colisões por perto',
    crashesInView: 'Colisões à vista',
    crashesIntro: 'Dos registros de colisões do PennDOT, como as configurações da camada de colisões os escolhem. Abra uma para ler mais.',
    crashCount: (n) => pl(n, '# colisão', '# colisões'),
    crashesMore: (n) => `${pl(n, '# colisão a mais está', '# colisões a mais estão')} à vista. Aproxime para listá-las aqui.`,
    crashNear: (street) => `Perto de ${street}`,
    crashesNone: 'Nenhuma colisão é desenhada nesta parte do mapa.',
    removal: 'Pedir a retirada',
    removalNote: (hasEmail) =>
      hasEmail
        ? 'Qualquer pessoa pode pedir que retiremos este memorial, por e-mail privado. Fazemos isso sem perguntar por quê.'
        : 'Qualquer pessoa pode pedir que retiremos este memorial, sem dar um motivo. Um endereço de e-mail privado para isso vem em breve; até lá, a página de Contato explica como pedir em uma issue do GitHub, que qualquer pessoa pode ler.',
    crashTitle: (year) => `Colisão em ${year}`,
    crashesHere: (n) => `${pl(n, '# colisão', '# colisões')} neste local`,
    involved: 'Quem estava envolvido',
    involvedModes: {
      walk: 'alguém a pé',
      bike: 'alguém de bicicleta',
      motorcycle: 'alguém de moto',
      scooter: 'alguém de patinete',
    },
    involvedOthers: 'pessoas em carros ou outros veículos',
    crashSource: 'Dos registros de colisões do PennDOT.',
    segmentScore: (score, lens) => `${lens}: ${score} de 100 na sua combinação de lentes`,
    segmentNoScore: 'Sem pontuação de segurança da rua para este quarteirão.',
    onHin: 'Na Rede de Lesões Graves',
    ksi: (n) =>
      `${pl(n, '# pessoa morreu ou ficou gravemente ferida', '# pessoas morreram ou ficaram gravemente feridas')} ao caminhar ou andar de bicicleta neste quarteirão ou nas esquinas dele, nos últimos cinco anos de registros do PennDOT`,
    noKsi: 'Ninguém registrado como morto ou gravemente ferido ao caminhar ou andar de bicicleta aqui nos últimos cinco anos de registros do PennDOT',
    killed2: (n) => `${pl(n, '# pessoa morreu', '# pessoas morreram')} aqui nos últimos dois anos`,
    school: 'Uma escola a menos de 400 metros',
  },

  streetsStops: {
    shelterLegend: 'Um abrigo na lista da Prefeitura, como um anel em volta do ponto dele',
    shelterLegendLens: 'Um ponto com abrigo da Prefeitura conta como abrigado na lente de conforto no transporte.',
    shelterLegendDate:
      'A Prefeitura mudou a sua lista pela última vez em janeiro de 2025, então um abrigo instalado ou retirado desde então pode estar faltando.',
    shelterTitle: 'Um abrigo de ônibus na lista da Prefeitura',
    shelterAt: (stop) => `Ele atende o ponto ${stop} da SEPTA.`,
    shelterListed: (number) => `A Prefeitura o lista com o número de ponto ${number}.`,
    shelterByNumber: 'Associado ao ponto da SEPTA pelo número de ponto na lista da Prefeitura.',
    shelterByPlace:
      'Associado ao ponto da SEPTA mais próximo, a até 15 metros: a lista da Prefeitura não traz nenhum número de ponto que combine.',
    shelterNoStop:
      'Não encontramos nenhum ponto da SEPTA que ele atenda: ele fica a mais de 15 metros de todos os pontos, ou o ponto dele fechou.',
    shelterDigital: 'O painel de publicidade dele é uma tela digital.',
    shelterLens: 'O ponto que ele atende conta como abrigado na lente de conforto no transporte.',
    shelterPartner: 'A Prefeitura instala e mantém estes abrigos com o seu parceiro de publicidade, e a publicidade paga por eles.',
    shelterSource: 'Da lista de abrigos de ônibus da Prefeitura (Escritório de Transporte e Sistemas de Infraestrutura).',
    sheltersHere: (n) => `${pl(n, '# abrigo', '# abrigos')} neste local`,

    poleLed: 'Uma lâmpada LED que a Prefeitura lista',
    poleOther: 'Uma lâmpada mais antiga, de vapor de sódio de alta pressão',
    poleUnknown: 'Uma lâmpada de um tipo que a Prefeitura não nomeia',
    poleNone: 'Um poste sem lâmpada listada, como um poste de semáforo ou de serviços públicos',
    polesNote: 'As lâmpadas que a Prefeitura lista, não se uma lâmpada funciona esta noite. Informe ao Philly311 uma luz apagada.',
    polesZoom: 'Aproxime até alguns quarteirões para ver os postes.',
    poleTitle: (number) => (number ? `Poste de rua ${number}` : 'Um poste de rua sem número listado'),
    poleKind: {
      0: 'A Prefeitura não lista nenhuma lâmpada neste poste.',
      1: 'A Prefeitura lista uma lâmpada LED neste poste.',
      2: 'A Prefeitura lista uma lâmpada mais antiga, de vapor de sódio de alta pressão, neste poste.',
      3: 'A Prefeitura lista uma lâmpada neste poste, mas não o tipo dela.',
    },
    poleOwner: {
      1: 'O poste é do Departamento de Ruas da Prefeitura.',
      2: 'O poste é da PECO.',
      3: 'O poste é do PennDOT.',
      4: 'O poste é de alguém que não é a Prefeitura, a PECO nem o PennDOT.',
    },
    poleReport: (number) => `Se uma luz aqui estiver apagada, diga ao Philly311 o número do poste, ${number}.`,
    poleReportNoNumber: 'Se uma luz aqui estiver apagada, diga ao Philly311 onde ela fica.',
    polesHere: (n) => `${pl(n, '# poste', '# postes')} neste local`,
    poleSource: 'Da lista de postes de rua do Departamento de Ruas, atualizada toda semana.',

    calmingLegend: 'Uma almofada de velocidade, lombada ou faixa elevada',
    calmingLegendNote: 'Os vizinhos podem pedir à Prefeitura moderação de tráfego em uma rua residencial.',
    zoomStreets: 'Aproxime até alguns bairros para vê-los.',
    calmingTitle: 'Moderação de tráfego',
    calmingWhat: 'Uma almofada de velocidade, lombada ou faixa elevada que o Departamento de Ruas lista, para fazer os motoristas reduzirem a velocidade.',
    calmingOn: (street) => `Em ${street}`,
    calmingSince: (date) => `Foi instalada em ${date}.`,
    calmingHere: (n) => `${pl(n, '# dispositivo', '# dispositivos')} neste local`,
    calmingSource: 'Da lista de dispositivos de moderação de tráfego do Departamento de Ruas.',

    guardLegend: 'Uma esquina onde a Prefeitura posta um guarda de travessia escolar',
    guardLegendNote:
      'Os guardas de travessia ajudam crianças e todo mundo a atravessar perto de escolas no começo e no fim do dia letivo.',
    guardTitle: 'Guarda de travessia escolar',
    guardHere: 'A Prefeitura posta um guarda de travessia escolar nesta esquina.',
    guardSchool: (school) => `A escola mais próxima na lista da Prefeitura, a menos de 400 metros: ${school}.`,
    guardWhat:
      'Os guardas de travessia ajudam crianças e todo mundo a atravessar com segurança perto de escolas no começo e no fim do dia letivo.',
    guardsHere: (n) => `${pl(n, '# posto', '# postos')} neste local`,
    guardSource: 'Da lista da Prefeitura de locais de guardas de travessia escolar.',

    blockPoles: (poles, lamps, led) =>
      lamps === 0
        ? `A Prefeitura lista ${pl(poles, '# poste', '# postes')} ao longo deste quarteirão, sem nenhuma lâmpada listada ${poles === 1 ? 'nele' : 'neles'}.`
        : `A Prefeitura lista ${pl(poles, '# poste', '# postes')} ao longo deste quarteirão, ${formatNumber(lamps)} com lâmpada, ${led === lamps ? (lamps === 1 ? 'que é LED' : 'todas LED') : `${formatNumber(led)} delas LED`}.`,
    blockNoPoles: 'A Prefeitura não lista nenhum poste de rua ao longo deste quarteirão.',
    blockCalming: (n, year) =>
      year
        ? `Moderação de tráfego aqui desde ${year}: a Prefeitura lista ${pl(n, '# almofada, lombada ou faixa elevada', '# almofadas, lombadas ou faixas elevadas')} neste quarteirão.`
        : `A Prefeitura lista ${pl(n, '# almofada, lombada ou faixa elevada', '# almofadas, lombadas ou faixas elevadas')} neste quarteirão.`,
    blockNoCalming: 'Nenhuma moderação de tráfego registrada aqui ainda.',
    blockArterial:
      'As almofadas de velocidade da Prefeitura são para ruas residenciais. Em uma rua como esta, pergunte ao Escritório de Transporte e Sistemas de Infraestrutura da Prefeitura sobre outras mudanças.',
    memorialCalming: (n, year) =>
      year
        ? `Moderação de tráfego neste quarteirão desde ${year}: a Prefeitura lista ${pl(n, '# dispositivo', '# dispositivos')}.`
        : `A Prefeitura lista ${pl(n, '# dispositivo de moderação de tráfego', '# dispositivos de moderação de tráfego')} neste quarteirão.`,
    memorialNoCalming: 'Nenhuma moderação de tráfego registrada neste quarteirão ainda.',
    lightsPoles: (poles, lamps, led) =>
      lamps === 0
        ? `A Prefeitura lista ${pl(poles, '# poste', '# postes')} ao longo deste quarteirão, sem nenhuma lâmpada listada.`
        : `Ao longo deste quarteirão, a Prefeitura lista ${pl(lamps, '# poste', '# postes')} com lâmpada, ${led === lamps ? (lamps === 1 ? 'LED' : 'todos LED') : `${formatNumber(led)} deles LED`}. Ative "Postes de rua e as lâmpadas que a Prefeitura lista" e aproxime para achar o número de cada poste.`,
    stopLamps: (lamps, led) =>
      lamps === 0
        ? 'A Prefeitura não lista nenhum poste com lâmpada a menos de 30 metros deste ponto.'
        : `A Prefeitura lista ${pl(lamps, '# poste', '# postes')} com lâmpada a menos de 30 metros deste ponto, ${led === lamps ? (lamps === 1 ? 'LED' : 'todos LED') : `${formatNumber(led)} deles LED`}.`,
    cityShelter: (n) =>
      n === 1 ? 'A lista de abrigos de ônibus da Prefeitura tem um abrigo aqui.' : `A lista de abrigos de ônibus da Prefeitura tem ${formatNumber(n)} abrigos aqui.`,
    noCityShelter:
      'Nenhum abrigo aqui na lista de abrigos de ônibus da Prefeitura, que traz os abrigos que ela administra com o seu parceiro de publicidade.',
    disagree:
      'A lista da Prefeitura tem um abrigo aqui, mas o OpenStreetMap diz que não há nenhum. Um dos dois pode estar desatualizado: uma verificação resolve. Até lá, a prioridade conta o abrigo da Prefeitura.',
    cityShelterLens: 'A prioridade conta o abrigo da Prefeitura.',
    answerCityShelter: 'Ainda não verificado no OpenStreetMap, mas na lista da Prefeitura',
  },

  parking: {
    kinds: {
      all: 'Veículos bloqueando a passagem',
      sidewalk: 'Na calçada',
      bike_lane: 'Em uma ciclofaixa',
      crosswalk: 'Em uma faixa de pedestres',
      corner: 'Em uma esquina',
      ramp: 'Bloqueando uma rampa de calçada',
    },
    window: (start, end) => `De ${start} a ${end}`,
    windowUnknown: 'Ao longo de 12 meses',
    heatTitle: (window) => `Com o mapa afastado: onde os relatos se concentram. ${window}.`,
    fewer: 'Menos relatos',
    more: 'Mais relatos',
    binsTitle: 'De perto: relatos em cada área de cerca de um quarteirão de largura',
    bins: (low, high) => (high === null ? `${formatNumber(low)} ou mais` : `${formatNumber(low)} a ${formatNumber(high)}`),
    threshold: (min) =>
      `As áreas com menos de ${min} relatos ficam de fora, para que nenhum relato isolado apareça. Aproxime e toque em uma área para ver as contagens dela.`,
    oneApp:
      'Onde pessoas que usam um aplicativo, o Laser Vision do Philly Bike Action, relataram veículos atrapalhando a passagem. Nem todo problema é relatado.',
    title: 'Esta área, de cerca de um quarteirão de largura',
    summary: (n, window) => `${pl(n, '# relato', '# relatos')} de veículos bloqueando a passagem. ${window}.`,
    count: (n) => formatNumber(n),
    fewerThan: (min) => `menos de ${min}`,
    byKind: 'Por tipo',
    meaning:
      'São relatos de pessoas que usam um aplicativo, então mostram onde essas pessoas notaram veículos atrapalhando, não todos os problemas. Um tipo com menos de 5 relatos aqui não é dado como número, para que nenhum relato isolado apareça.',
    fixes:
      'Muitos relatos em um mesmo lugar são evidência a favor de mudanças físicas: alargamentos de calçada, balizadores, esquinas com visibilidade livre, ciclovias protegidas e zonas de carga e descarga.',
    askCity: 'Pergunte à Prefeitura sobre uma solução',
    source: 'Do mapa Laser Vision do Philly Bike Action',
    refreshed: 'Contado de novo toda semana, com a permissão do Philly Bike Action.',
  },

  transit: {
    waitTitle: 'Com que frequência passa um ônibus ou trem ao meio-dia em dias úteis',
    waitBins: [
      'A cada 10 minutos ou menos',
      'A cada 11 a 15 minutos',
      'A cada 16 a 30 minutos',
      'A cada 31 a 60 minutos',
      'Menos de uma vez por hora',
    ],
    noMidday: 'Sem serviço das 10h às 14h em dias úteis',
    boardingsTitle: 'Pessoas que embarcam aqui em um dia útil médio',
    boardingBins: ['1.000 ou mais', '200 a 999', '50 a 199', '10 a 49', 'Menos de 10'],
    noCount: 'Sem contagem da SEPTA para este ponto',
    boardingsNote: 'Das contagens da própria SEPTA, que ficam uma ou duas temporadas atrás dos horários.',
    station: 'Estação de metrô, El ou trem regional',
    zoomNote: 'Aproxime até alguns bairros para ver os pontos.',
    lensTitle: 'Prioridade na lente de conforto no transporte',
    lensUnsurveyed: 'Onde ninguém verificou um ponto ainda, o abrigo e o banco dele contam pela metade.',
    lensCityShelter: 'Um ponto com abrigo na lista da Prefeitura conta como abrigado.',
    lensStations: 'A lente pontua só pontos de ônibus e de bonde, então as estações aparecem vazadas.',
    lensTunnel:
      'Os pontos de bonde no túnel sob o Center City e o University City também aparecem vazados: a lente os deixa de fora, como faz com as estações.',
    findTitle: 'O que os passageiros encontram aqui',
    notInOsm: 'Ainda não encontramos um ponto correspondente no OpenStreetMap, então ninguém registrou se ele tem abrigo ou banco.',
    matchedByNumber: 'Associado ao ponto do OpenStreetMap com o mesmo número de ponto, no mesmo lugar.',
    matchedByPlace: 'Associado ao ponto do OpenStreetMap no mesmo lugar, a até 15 metros.',
    halfway: 'Respostas ainda não verificadas contam pela metade (50 de 100) na pontuação até que alguém as registre.',
    canopy: (percent) =>
      `A copa das árvores cobre cerca de ${formatNumber(percent)} por cento do terreno em volta do ponto, em uma área de cerca de dois quarteirões de largura (o levantamento de cobertura de árvores de 2018 da Prefeitura).`,
    onHin: 'O ponto está na Rede de Lesões Graves, as ruas onde acontece a maior parte das mortes e lesões graves no trânsito da Filadélfia.',
    noScore: 'A lente de conforto no transporte pontua só pontos de ônibus e de bonde.',
    tunnelStation:
      'Este ponto de bonde é subterrâneo, no túnel, então a lente de conforto no transporte o deixa de fora, como faz com as estações de metrô e de trem.',
    answersLoading: 'Carregando o que o OpenStreetMap diz sobre este ponto.',
    answersUnavailable:
      'Não foi possível carregar agora o que o OpenStreetMap diz sobre este ponto, então o abrigo e o banco dele contam como ainda não verificados.',
    canDo: 'O que os vizinhos podem fazer aqui',
    routeDetails: 'Passos, contatos e links',
    surveyGuide: 'Como verificar um ponto com o StreetComplete',
    osmSource: 'Abrigo, banco e iluminação do OpenStreetMap, © colaboradores do OpenStreetMap, atualizado toda semana.',
    routeBus: 'Linha de ônibus',
    routeTrolley: 'Linha de bonde',
    routeMetro: 'Metrô ou El',
    routeRail: 'Trem regional',
    allRoutes: 'Onde várias linhas dividem uma rua, os traçados delas ficam um em cima do outro.',
    frequentRoutes: 'Só linhas com um ônibus ou trem a cada 15 minutos ou menos ao meio-dia em dias úteis.',
    detailsTitle: 'Ponto',
    stationName: (name) => `Estação ${name}`,
    stopsHere: (n) => `${pl(n, '# ponto', '# pontos')} neste local`,
    kinds: {
      bus: 'Ponto de ônibus',
      trolley: 'Ponto de bonde',
      busTrolley: 'Ponto de ônibus e de bonde',
      metro: 'Estação de metrô ou El',
      rail: 'Estação de trem regional',
    },
    vehicles: { bus: 'ônibus', trolley: 'bonde', busTrolley: 'ônibus ou bonde', train: 'trem' },
    vehiclesMany: { bus: 'ônibus', trolley: 'bondes', busTrolley: 'ônibus ou bondes', train: 'trens' },
    routes: (list) => `Linhas: ${list}.`,
    route: (name) => `Linha ${name}.`,
    howOften: 'Com que frequência',
    every: (vehicle, minutes) =>
      minutes <= 1 ? `um ${vehicle} a cada minuto, mais ou menos` : `um ${vehicle} a cada ${formatNumber(minutes)} minutos, mais ou menos`,
    only: (one, many, n) => (n === 1 ? `só um ${one}` : `só ${formatNumber(n)} ${many}`),
    peak: (text) => `Manhãs de dias úteis, das 7h às 9h: ${text}.`,
    midday: (day, text) => `${day}, das 10h às 14h: ${text}.`,
    noService: (day) => `${day}, das 10h às 14h: nenhum.`,
    days: { wk: 'Dias úteis', sa: 'Sábados', su: 'Domingos' },
    trips: (wk, sa, su) =>
      `${pl(wk, '# partida', '# partidas')} em um dia útil típico, ${formatNumber(sa)} aos sábados e ${formatNumber(su)} aos domingos.`,
    busiest: (n) => `Hora de maior movimento em dias úteis: ${pl(n, '# partida', '# partidas')}.`,
    firstLast: (first, last) => `Em dias úteis, a primeira parte às ${first} e a última às ${last}.`,
    afterMidnight: (time) => `${time} depois da meia-noite`,
    allNight: 'O serviço funciona a noite toda em dias úteis.',
    evening: (n) =>
      n === 0 ? 'Nenhuma partida depois das 20h em dias úteis.' : `Depois das 20h em dias úteis: ${pl(n, '# partida', '# partidas')}.`,
    noWeekday: 'Sem serviço em dias úteis.',
    riders: 'Passageiros',
    boardings: (n, period) =>
      n === 0
        ? `Quase ninguém embarca aqui em um dia útil médio (contagem da SEPTA, ${period}).`
        : `Cerca de ${pl(n, '# pessoa embarca', '# pessoas embarcam')} aqui em um dia útil médio (contagem da SEPTA, ${period}).`,
    countedAt: (id) => `Contado no ponto ${id} da SEPTA, que este ponto substituiu.`,
    noBoardings:
      'A SEPTA ainda não tem contagem para este ponto. Pontos novos e renumerados ganham uma quando a SEPTA publica a contagem seguinte.',
    noStationCounts: 'A SEPTA não publica contagens para cada plataforma de metrô ou El.',
    noRailCounts: 'A SEPTA conta os passageiros do Regional Rail por estação uma vez por ano; este mapa ainda não mostra essas contagens.',
    stopNumber: (id) => `Número do ponto da SEPTA: ${id}.`,
    formerNumbers: (ids) => `Antes disso, era o ponto ${ids} da SEPTA.`,
    wheelchair: {
      1: 'A SEPTA lista este ponto como acessível para cadeira de rodas.',
      2: 'A SEPTA lista este ponto como não acessível para cadeira de rodas.',
    },
    source: 'Dos horários da SEPTA para uma semana típica. As esperas são médias: os ônibus se juntam e os intervalos aumentam.',
  },

  stopAmenities: {
    unnamed: 'Um ponto sem nome no OpenStreetMap',
    number: (ref) => `Ponto número ${ref}`,
    served: { 1: 'Ponto de ônibus', 2: 'Ponto de bonde', 3: 'Ponto de ônibus e de bonde' },
    comfort: {
      3: 'Um abrigo, ou o ponto inteiro está debaixo de um teto',
      2: 'Um banco, mas nenhum abrigo mapeado',
      1: 'Sem abrigo e sem banco',
      0: 'Ainda não verificado',
    },
    factsTitle: 'O que o OpenStreetMap diz',
    answers: {
      sh: 'Abrigo',
      bn: 'Banco',
      bi: 'Lixeira',
      lt: 'Iluminado à noite',
      tp: 'Piso tátil para pessoas cegas',
      wc: 'Acesso para cadeira de rodas',
      db: 'Painel de partidas',
      cv: 'Ponto inteiro debaixo de um teto',
    },
    yes: 'Sim',
    no: 'Não',
    limited: 'Limitado',
    unknown: 'Ainda não verificado',
    nearby: 'mapeado separadamente, ao lado do ponto',
    unknownNote: 'Ainda não verificado significa que ninguém registrou isso ainda. Não significa que o ponto não tenha nada.',
    survey: 'Como verificar este ponto com o StreetComplete',
    openOsm: 'Ver este ponto no OpenStreetMap',
    surveyRoute: 'Verificar uma linha inteira com uma ficha para imprimir',
    source: 'Do OpenStreetMap, © colaboradores do OpenStreetMap, atualizado toda semana.',
  },

  heat: {
    tractsTitle: {
      vulnerability: 'Vulnerabilidade ao calor: o calor e as pessoas em risco, por setor censitário',
      exposure: 'Exposição ao calor: quanto esquenta cada setor censitário no verão',
      sensitivity: 'Sensibilidade ao calor: quantas pessoas de cada setor censitário estão em risco no calor',
    },
    fifths: {
      vulnerability: ['Os 20% de setores menos vulneráveis', 'Menos vulneráveis', 'Os 20% do meio', 'Mais vulneráveis', 'Os 20% de setores mais vulneráveis'],
      exposure: ['Os 20% de setores mais frescos', 'Mais frescos', 'Os 20% do meio', 'Mais quentes', 'Os 20% de setores mais quentes'],
      sensitivity: ['Os 20% com menos pessoas em risco', 'Menos', 'Os 20% do meio', 'Mais', 'Os 20% com mais pessoas em risco'],
    },
    priority: 'Com contorno: setores que a Prefeitura classifica como de vulnerabilidade ao calor muito alta',
    tractsNone: 'Os setores que o índice não informa, como grandes parques e o aeroporto, ficam sem cor.',
    tractsSource:
      'Do Índice de Vulnerabilidade ao Calor da Prefeitura (Departamento de Saúde Pública e Escritório de Sustentabilidade), dados de 2017 a 2019.',
    treeBig: 'Uma árvore da Prefeitura: quanto maior o ponto, mais largo o tronco',
    treeSmall: 'Uma árvore pequena, muitas vezes jovem, que precisa ser regada',
    treesZoom: 'Aproxime até alguns quarteirões para ver as árvores.',
    treesYards: 'As árvores em quintais particulares não estão no inventário da Prefeitura, então um quarteirão pode ter mais sombra do que parece aqui.',
    floodHigh: 'A planície de inundação com 1 por cento de chance por ano: uma enchente tem pelo menos 1 chance em 100 a cada ano',
    floodway: 'O canal de escoamento: o canal mantido livre para a água das enchentes passar',
    floodModerate: 'A área com 0,2 por cento de chance por ano: 1 chance em 500 a cada ano',
    floodCare:
      'Um motivo para cuidado, nunca parte de uma pontuação: as plantas ali precisam aguentar solo encharcado, e qualquer construção segue as regras da Prefeitura para planícies de inundação.',
    treeUnnamed: 'Uma árvore que o inventário não nomeia',
    treeTrunk: (inches) => `O tronco dela tem cerca de ${formatNumber(inches)} polegadas de largura na altura do peito.`,
    treeNoTrunk: 'O inventário não informa o tamanho do tronco dela.',
    treeYoung: 'Uma árvore jovem precisa de cerca de 20 galões de água por semana, de março a dezembro, segundo o TreePhilly.',
    treesHere: (n) => `${pl(n, '# árvore', '# árvores')} neste local`,
    treeSource: 'Do inventário de árvores de Parques e Recreação, as árvores que a Prefeitura mantém em suas ruas e parques.',
  },

  art: {
    legend: {
      mural: 'Murais e pinturas em paredes',
      sculpture: 'Esculturas e estátuas',
      mosaic: 'Mosaicos',
      other: 'Outros tipos: instalações, fontes, monumentos e mais',
    },
    allOff: 'Todos os tipos de arte estão desligados nas configurações desta camada.',
    insideHidden: 'Obras dentro de prédios ficam ocultas.',
    memorialNote: 'Obras de arte que lembram alguém são mostradas sem nomes.',
    coverage:
      'Da lista Percent for Art da Prefeitura, do OpenStreetMap e do Wikidata. Muitos murais ainda não estão neles; o Mural Arts Philadelphia mantém a maior lista no próprio site.',
    kinds: {
      0: 'Uma obra de arte pública',
      1: 'Um mural',
      2: 'Uma pintura',
      3: 'Arte de rua',
      4: 'Um mosaico',
      5: 'Uma escultura',
      6: 'Uma estátua',
      7: 'Um busto',
      8: 'Um relevo',
      9: 'Uma instalação',
      10: 'Uma fonte',
      11: 'Um monumento',
      12: 'Um memorial',
      13: 'Um vitral',
      14: 'Uma placa',
    },
    untitled: 'Nenhum título registrado.',
    by: (artist) => `De ${artist}.`,
    made: (year) => `Feita em ${year}.`,
    medium: (medium) => `Feita de: ${medium}.`,
    where: (place) => `Onde: ${place}.`,
    inside: 'Dentro de um prédio, então só pode ser vista quando o prédio está aberto.',
    memorialTitle: 'Obra de arte memorial',
    memorialText:
      'Esta obra de arte lembra alguém. O Placekeepers não mostra nomes em memoriais; as fontes abaixo dizem mais sobre ela.',
    worksHere: (n) => `${pl(n, '# obra de arte', '# obras de arte')} neste local`,
    sourcesTitle: 'Fontes',
    cityRecord: 'O registro da Prefeitura sobre esta obra (PDF)',
    cityList: 'A lista Percent for Art da Prefeitura',
    openOsm: 'Ver no OpenStreetMap',
    openWikidata: 'Ver no Wikidata',
    openWikipedia: 'Ler sobre ela na Wikipédia',
    website: (site) => `Mais sobre ela em ${site}`,
    siteNames: {
      'associationforpublicart.org': 'o site da Association for Public Art',
      'muralarts.org': 'o site do Mural Arts Philadelphia',
      'philart.net': 'philart.net',
    },
    muralArts: 'Buscar na lista de murais do próprio Mural Arts Philadelphia',
    fix: 'Falta algo ou está errado? Adicione ou corrija no OpenStreetMap; as mudanças chegam a este mapa em cerca de uma semana.',
    fixLink: 'Editar no OpenStreetMap',
    credit: 'Arte pública da Prefeitura da Filadélfia, do OpenStreetMap (© colaboradores do OpenStreetMap) e do Wikidata.',
  },

  survey: {
    pageTitle: 'Verificar uma linha',
    intro:
      'Escolha uma linha de ônibus ou de bonde da SEPTA e uma direção para receber uma ficha de verificação: os pontos dela na Filadélfia em ordem, o que o OpenStreetMap mostra em cada um agora e caixas para preencher. Imprima a ficha, ou marque as caixas no celular conforme for andando.',
    guideLink: 'Como verificar pontos de ônibus',
    loading: 'Carregando as linhas…',
    loadFailed: 'Não foi possível carregar a lista de linhas. Verifique a sua conexão e tente de novo.',
    notPublished: 'As fichas de verificação ainda não foram publicadas. Elas aparecem depois da próxima atualização semanal.',
    sheetFailed: 'Não foi possível carregar a ficha desta linha. Verifique a sua conexão e tente de novo.',
    retry: 'Tentar de novo',
    routeLabel: 'Linha',
    routePlaceholder: 'Escolha uma linha',
    buses: 'Linhas de ônibus',
    trolleys: 'Linhas de bonde',
    directionLabel: 'Direção',
    partsLabel: 'Dividir entre',
    partsChoice: (n) => (n === 1 ? 'uma pessoa ou dupla' : `${n} pessoas ou duplas`),
    directionTo: (dir, to) => `${dir} para ${to}`,
    towards: (to) => `Rumo a ${to}`,
    directionNumber: (n) => `Direção ${n}`,
    stopCount: (n) => pl(n, '# ponto', '# pontos'),
    title: (route, direction) => `Linha ${route}, ${direction}`,
    summary: (stops, miles) =>
      `${pl(stops, '# ponto', '# pontos')} na Filadélfia, ${miles} do primeiro ao último em linha reta.`,
    outside: (n) =>
      `${pl(n, '# ponto a mais fica fora da Filadélfia e não está nesta ficha', '# pontos a mais ficam fora da Filadélfia e não estão nesta ficha')}.`,
    answersMissing:
      'Não foi possível carregar agora o que o OpenStreetMap diz sobre estes pontos, então os pontos que ele conhece aparecem como ainda não verificados.',
    statusTitle: 'O que o OpenStreetMap mostra agora',
    status: {
      shelter: 'Abrigo',
      bench: 'Só banco',
      neither: 'Nenhum dos dois',
      unsurveyed: 'Ainda não verificado',
      missing: 'Não encontrado no OpenStreetMap',
    },
    statusLong: {
      shelter: 'com abrigo ou teto',
      bench: 'com banco, mas sem abrigo mapeado',
      neither: 'sem nenhum dos dois',
      unsurveyed: 'no OpenStreetMap, mas ainda não verificado',
      missing: 'não encontrado no OpenStreetMap',
    },
    estimateTitle: 'Quanto tempo leva',
    estimate: (time) => `Nossa estimativa: ${time} para uma pessoa ou dupla.`,
    estimateBasis:
      'Esta é a nossa própria estimativa, não uma medição: andando cerca de 3 milhas por hora de um ponto a outro, e cerca de um minuto em cada ponto. Chegar ao primeiro ponto e voltar para casa é tempo extra.',
    trolleyTunnel:
      'As linhas de bonde T1 a T5 correm no subsolo na ponta do Center City, em um túnel com estações da 13th Street à 37th Street. Deixe essas estações de fora: esta verificação é para pontos na rua.',
    asOf: (osm, schedules) =>
      [osm ? `O que o OpenStreetMap mostra é de ${osm}.` : null, schedules ? `Pontos dos horários da SEPTA (${schedules}).` : null]
        .filter(Boolean)
        .join(' '),
    print: 'Imprimir a ficha',
    printAll: 'Imprimir todas as partes',
    printPart: (n) => `Imprimir só a parte ${n}`,
    part: (n, of) => `Parte ${n} de ${of}`,
    partStops: (first, last) => (first === last ? `ponto ${first}` : `pontos ${first} a ${last}`),
    partEstimate: (time, miles) => `Nossa estimativa: ${time} (${miles} de caminhada).`,
    sheetFor: (route, direction) => `Ficha de verificação: linha ${route}, ${direction}`,
    howToFill:
      'Marque S ou N para cada coisa que você encontrar no ponto. Iluminado significa que há uma luz acesa sobre o ponto à noite: uma lâmpada no abrigo ou um poste de rua bem ao lado. Precisa de reparo significa um abrigo, banco, placa ou lixeira quebrado. Se você não souber dizer, deixe a caixa vazia: por favor, nunca adivinhe.',
    nameLine: 'Nome:',
    dateLine: 'Data:',
    columns: {
      number: '#',
      stop: 'Ponto',
      now: 'OpenStreetMap agora',
      sh: 'Abrigo',
      bn: 'Banco',
      bi: 'Lixeira',
      lt: 'Iluminado',
      rp: 'Precisa de reparo',
      nt: 'Anotações',
    },
    yes: 'Sim',
    no: 'Não',
    yesShort: 'S',
    noShort: 'N',
    stopNumber: (sid) => `Ponto ${sid} da SEPTA`,
    answerLabel: (n, name, question, answer) => `Ponto ${n}, ${name}: ${question}, ${answer}`,
    repairLabel: (n, name) => `Ponto ${n}, ${name}: precisa de reparo`,
    notesLabel: (n, name) => `Ponto ${n}, ${name}: anotações`,
    openOsm: 'Ver no OpenStreetMap',
    editOsm: 'Editar',
    answered: (n, of) => `Você preencheu ${formatNumber(n)} de ${pl(of, '# ponto', '# pontos')} neste aparelho.`,
    kept: 'O que você marca e digita aqui fica só neste navegador, neste aparelho. Nada é enviado a lugar nenhum.',
    notKept: 'Este navegador não está guardando o que você marca, então isso se perde se você sair da página. Imprima a ficha ou anote.',
    clear: 'Limpar o que preenchi',
    clearConfirm: 'Limpar todas as caixas e anotações que você preencheu para esta direção?',
    safetyTitle: 'Antes de sair: fique em segurança',
    safety: [
      'Fique na calçada. Nunca fique na rua nem entre em uma faixa de ônibus para olhar um ponto.',
      'Vá de dia e vá com um amigo.',
      'Pare de andar antes de olhar esta ficha ou o celular, e olhe para cima antes de atravessar.',
      'Saia do caminho para que os passageiros possam esperar e embarcar. Não fotografe pessoas.',
    ],
    answersTitle: 'Como levar as suas respostas ao OpenStreetMap',
    withApp:
      'Com o aplicativo StreetComplete: responda às perguntas dele sobre cada ponto enquanto estiver lá. Suas respostas vão direto para o OpenStreetMap.',
    withoutApp: 'Sem aplicativo no celular, em um computador, de volta em casa, use o editor do próprio OpenStreetMap:',
    editorSteps: [
      'Entre em openstreetmap.org. Criar uma conta é grátis.',
      'Abra esta página de novo e use o link Editar ao lado de cada ponto. O editor abre com o ponto selecionado.',
      'No painel à esquerda, clique na caixa Shelter (abrigo). Em "Add field:" (adicionar campo), adicione Bench (banco), Waste Bin (lixeira) e Lit (iluminado), e clique nessas caixas também. Cada caixa muda a cada clique: Yes (sim), depois No (não), depois volta para Unknown (desconhecido).',
      'Clique em Save (salvar), escreva uma nota curta sobre o que você fez, como "Surveyed bus stop shelters and benches" (verificados abrigos e bancos de pontos de ônibus), e clique em Upload (enviar).',
    ],
    notFound:
      'Onde a ficha diz "Não encontrado no OpenStreetMap", olhe bem em volta do ponto no editor primeiro: ele pode estar desenhado a alguns passos de distância. Se ele realmente estiver faltando, clique em Point (ponto), coloque o ponto na calçada, ao lado da placa do ponto, e escolha Bus Stop (ponto de ônibus).',
    repairNote:
      'O OpenStreetMap não registra danos, então "Precisa de reparo" e as suas anotações ficam com o seu grupo. Elas ajudam quando você conversa com a SEPTA ou com a Prefeitura sobre um ponto.',
    updates: 'O Placekeepers lê o OpenStreetMap toda segunda-feira, então as suas respostas chegam ao nosso mapa e a estas fichas em cerca de uma semana.',
    printedFrom: 'Impresso do Placekeepers, um mapa gratuito para vizinhos da Filadélfia. Pontos da SEPTA; dados do mapa © colaboradores do OpenStreetMap.',
    routeTitle: (route) => `Linha ${route}`,
    routesHere: (n) => `${pl(n, '# linha', '# linhas')} aqui`,
    surveyThisRoute: 'Verificar os pontos desta linha quanto a abrigos e bancos',
  },

  amenities: {
    legend: {
      benches: 'Um banco',
      picnic_tables: 'Uma mesa de piquenique',
      drinking_water: 'Água potável',
      toilets: 'Um banheiro público',
      bookcases: 'Uma Little Free Library (estante pública de livros)',
    },
    mappedNote: 'Só aparece aqui o que as pessoas adicionaram ao OpenStreetMap, então muita coisa está faltando.',
    addMissing: 'Como adicionar o que está faltando',
    titles: {
      benches: 'Banco',
      picnic_tables: 'Mesa de piquenique',
      drinking_water: 'Água potável',
      toilets: 'Banheiro público',
      bookcases: 'Little Free Library',
    },
    facts: {
      br: ['Tem encosto', 'Sem encosto'],
      cv: ['Coberto', 'Sem cobertura'],
      bt: ['Dá para encher uma garrafa aqui', 'Não serve para encher garrafa'],
      sn: ['Só em parte do ano', 'O ano todo'],
      in: ['Em ambiente fechado', 'Ao ar livre'],
      fee: ['Tem taxa', 'Grátis'],
      ct: ['Tem trocador', 'Sem trocador'],
    },
    access: { 1: 'Aberto a qualquer pessoa', 2: 'Só para clientes' },
    wheelchair: {
      1: 'Acessível para cadeira de rodas',
      0: 'Não acessível para cadeira de rodas',
      2: 'Acesso limitado para cadeira de rodas',
    },
    hours: (text) => `Horário de funcionamento como mapeado: ${text}`,
    nothingMore: 'O OpenStreetMap ainda não diz mais nada sobre isso.',
    unknownNote: 'O que não está listado ainda não se sabe. Isso não significa que a resposta seja não.',
    openOsm: 'Ver no OpenStreetMap',
    fix: 'Falta algo ou está errado? Como corrigir',
    source: 'Como mapeado no OpenStreetMap, © colaboradores do OpenStreetMap, atualizado toda semana.',
  },

  places: {
    legend: {
      park_water: 'Um bebedouro em um parque',
      libraries: 'Uma unidade da Free Library',
      recreation_centers: 'Um centro recreativo',
      playgrounds: 'Um parquinho',
    },
    poolLegend: { 1: 'Uma piscina', 2: 'Uma área de jogos de água', 3: 'Um aspersor' },
    notInService: 'Fora de funcionamento neste ano',
    poolsShown: {
      in_service: 'Só as que estão em funcionamento neste ano são mostradas.',
      all: 'Círculos vazios não estão em funcionamento neste ano.',
    },
    recreationKinds: {
      1: 'Centro recreativo',
      2: 'Centro para pessoas mais velhas',
      3: 'Centro de educação ambiental',
    },
    poolKinds: { 1: 'Piscina', 2: 'Área de jogos de água', 3: 'Aspersor' },
    waterKinds: { 1: 'Bebedouro', 2: 'Ponto de encher garrafas' },
    status: { 1: 'Em funcionamento neste ano', 0: 'Fora de funcionamento neste ano' },
    statusUnknown: 'Parques e Recreação não informa se está em funcionamento neste ano.',
    indoor: { 1: 'Em ambiente fechado', 0: 'Ao ar livre' },
    waterIndoor: 'Dentro de um prédio: aberto quando o prédio está.',
    accessible: { 1: 'Listado como acessível para pessoas com deficiência', 0: 'Não listado como acessível' },
    opened: (date) => `Aberta para a temporada em ${date}.`,
    gym: 'Tem um ginásio.',
    noBuilding: 'Um local de programas sem prédio próprio.',
    inPark: (park) => `Em ${park}.`,
    phone: (number) => `Telefone: ${number}`,
    libraryPage: 'Horários e eventos no site da Free Library',
    seasonNote: 'As piscinas abrem só no verão. Confira com Parques e Recreação os horários desta semana.',
    source: {
      libraries: 'Da lista da Prefeitura de unidades da Free Library of Philadelphia.',
      parks: 'De Parques e Recreação da Filadélfia, como a Prefeitura publica.',
    },
    cooling: {
      legendOpen: 'Um local para se aquecer ou se refrescar listado como aberto',
      legendClosed: 'Listado como fechado, ou sem status',
      kindShown: {
        any: 'Locais para tempo quente e para tempo frio.',
        cooling: 'Só locais para se refrescar, para tempo quente.',
        warming: 'Só locais para se aquecer, para tempo frio.',
      },
      asListed: (copied, changed) =>
        `${copied ? `Como a Prefeitura os listou em ${copied}` : 'Como a Prefeitura os listou quando este mapa copiou a lista pela última vez'}${changed ? ` (a lista foi mudada pela última vez em ${changed})` : ''}. Não é ao vivo: os locais abrem e fecham conforme o tempo, então ligue para o local ou para o 311 antes de ir.`,
      oneMarker: 'Uma biblioteca ou um centro recreativo que também é um desses locais aparece uma vez, como um desses locais.',
      kinds: {
        1: 'Unidade da Free Library',
        2: 'Local de Parques e Recreação',
        3: 'Parceiro comunitário',
        4: 'Centro comunitário da Autoridade de Habitação da Filadélfia',
      },
      title: 'Local para se aquecer ou se refrescar',
      status: { 1: 'Listado como aberto', 0: 'Listado como fechado' },
      statusUnknown: 'Nenhum status listado',
      both: 'Listado como local para se aquecer e para se refrescar',
      cooling: 'Listado como local para se refrescar',
      warming: 'Listado como local para se aquecer',
      neither: 'Não listado como local para se aquecer nem para se refrescar',
      hours: (hours) => `Horário como listado: ${hours}`,
      services: (services) => `O que oferece, como listado: ${services}`,
      capacity: (n) => `Espaço para ${formatNumber(n)} pessoas, como listado`,
      water: 'Tem ponto de água',
      restroom: 'Tem banheiro público',
      also: {
        lib: (name) => `Também aparece no mapa como unidade da Free Library: ${name}.`,
        rec: (name) => `Também aparece no mapa como local de Parques e Recreação: ${name}.`,
      },
      alsoSite: 'A Prefeitura também o lista como local para se aquecer ou se refrescar.',
    },
    playgrounds: {
      kind: 'Parquinho',
      ages: { 1: 'Para idades de 2 a 5 anos', 2: 'Para idades de 5 a 12 anos', 3: 'Para idades de 2 a 12 anos' },
      installed: (year) => `Instalado em ${year}`,
    },
  },

  conditions: {
    legend: {
      dumping: 'Descarte ilegal de lixo',
      dark_lights: 'Uma luz de rua ou de beco apagada',
      graffiti: 'Pichação',
    },
    legendOpen: (what) => `${what}: um pedido ainda aberto`,
    legendClosed: (what) => `${what}: todos os pedidos fechados`,
    legendSize: 'Um círculo maior significa mais pedidos naquele quarteirão.',
    legendWindow: 'Pedidos ao Philly311 nos últimos 90 dias, contados por quarteirão, nunca por endereço.',
    openOnly: 'Só são mostrados os quarteirões com um pedido ainda aberto.',
    titles: {
      dumping: 'Descarte ilegal de lixo informado',
      dark_lights: 'Luzes apagadas informadas',
      graffiti: 'Pichação informada',
    },
    summary: (n, open) =>
      `${pl(n, '# pedido', '# pedidos')} ao Philly311 nos últimos 90 dias, ${open === 0 ? 'nenhum ainda aberto' : open === 1 ? '1 ainda aberto' : `${formatNumber(open)} ainda abertos`}.`,
    newest: (date) => `O mais recente foi feito em ${date}.`,
    alley: (n, total) =>
      n === total ? (n === 1 ? 'Foi sobre uma luz de beco.' : 'Todos foram sobre luzes de beco.') : `${formatNumber(n)} deles sobre uma luz de beco.`,
    block: (street) => `Neste quarteirão de ${street}.`,
    byBlock: 'Contado por quarteirão, nunca por endereço, e nada sobre quem informou é mostrado.',
    meaning: 'Um pedido mostra que alguém notou e pediu ajuda à Prefeitura. Alguns quarteirões pedem com mais frequência do que outros.',
    report: 'Informar ao Philly311',
    source: 'Dos registros 311 da Prefeitura (Philly311), atualizados toda semana.',
  },

  walk: {
    walkTitle: {
      index: 'Quanto cada área é caminhável (o índice de caminhabilidade da EPA)',
      corners: 'Esquinas: quanto as ruas são conectadas (EPA)',
      transit: 'Quão perto fica o ponto de transporte mais próximo (EPA)',
      mix: 'Quão bem se misturam casas, empregos e lojas (EPA)',
    },
    walkCompared: {
      city: 'Comparado dentro da Filadélfia: cada tom reúne cerca de um quinto dos grupos de quarteirões da cidade.',
      nation: 'Comparado com o país inteiro, como a EPA classifica todos os grupos de quarteirões dos Estados Unidos.',
    },
    walkFifths: {
      index: ['Os 20% menos caminháveis', 'Menos caminhável', 'Os 20% do meio', 'Mais caminhável', 'Os 20% mais caminháveis'],
      corners: ['Menor número de esquinas', 'Menos', 'Os 20% do meio', 'Mais', 'Maior número de esquinas'],
      transit: ['Os 20% mais longe do transporte', 'Mais longe', 'Os 20% do meio', 'Mais perto', 'Os 20% mais perto do transporte'],
      mix: ['A menor mistura', 'Menos mistura', 'Os 20% do meio', 'Mais mistura', 'A maior mistura'],
    },
    walkNationFifths: ['Os 20% mais baixos do país', 'Abaixo do meio', 'Os 20% do meio', 'Acima do meio', 'Os 20% mais altos do país'],
    walkClasses: [
      'Menos caminhável: um índice de 1 a 5,75',
      'Abaixo da média: 5,76 a 10,5',
      'Acima da média: 10,51 a 15,25',
      'Mais caminhável: 15,26 a 20',
    ],
    walkNationNote:
      'Comparada com o país inteiro, quase toda a Filadélfia está acima da média ou entre as mais caminháveis, então comparar dentro da cidade mostra melhor as diferenças dela.',
    walkParts:
      'O índice pontua de 1 a 20. As esquinas e o transporte valem um terço cada, e duas medidas da mistura de casas, empregos e lojas valem um sexto cada.',
    walkSource: 'Do Smart Location Database da EPA (2021), feito com dados de cerca de 2017 a 2019.',

    reachTitle: {
      people: 'Pessoas que moram a até 5 minutos a pé (censo de 2020)',
      places: 'Tipos de lugares do dia a dia a até 10 minutos a pé',
      corners: 'Esquinas a até 5 minutos a pé',
    },
    reachBins: {
      people: ['Menos de 1.000 pessoas', '1.000 a 2.499', '2.500 a 3.999', '4.000 a 5.999', '6.000 ou mais'],
      places: ['2 ou menos dos 7 tipos', '3 ou 4 tipos', '5 tipos', '6 tipos', 'Todos os 7 tipos'],
      corners: ['Menos de 10 esquinas', '10 a 24', '25 a 49', '50 a 74', '75 ou mais'],
    },
    reachKinds:
      'Os sete tipos: uma biblioteca, um centro recreativo, uma piscina ou área de jogos de água em funcionamento, um bebedouro em um parque, uma escola, um mercado ou feira que aceita SNAP (o auxílio-alimentação do governo) e um ponto de ônibus, de bonde ou de trem.',
    reachCorners:
      'Uma esquina é onde se encontram três ou mais ruas em que as pessoas podem andar. Mais esquinas significam quarteirões mais curtos e mais formas de chegar a algum lugar a pé.',
    reachMeasured:
      'Contado a partir do meio de cada hexágono em linha reta: 400 metros para 5 minutos a pé, 800 para 10 minutos a pé. Isso alcança um pouco mais longe do que uma caminhada pelas ruas, e atravessa linhas de trem, vias expressas e rios.',
    reachSource: {
      people: 'Pessoas do censo de 2020, contadas por quarteirão.',
      places: 'Lugares da Prefeitura, de Parques e Recreação, do USDA e da SEPTA. Lugares logo do outro lado do limite da cidade não são contados.',
      corners: 'Esquinas dos eixos de ruas da Prefeitura.',
    },

    stressLevels: {
      1: 'Nível 1: tranquilo o bastante para a maioria das pessoas de todas as idades',
      2: 'Nível 2: bom para a maioria dos adultos',
      3: 'Nível 3: só para ciclistas confiantes',
      4: 'Nível 4: só para os ciclistas mais destemidos',
    },
    stressShown: {
      stressful: 'Só as ruas estressantes, níveis 3 e 4, são mostradas.',
      calm: 'Só as ruas tranquilas, níveis 1 e 2, são mostradas.',
    },
    stressZoom: 'Com o mapa afastado, ele mostra ruas estressantes e ruas com ciclofaixa ou trilha. Aproxime para ver todas as ruas.',
    stressSource:
      'Da rede Level of Traffic Stress da Delaware Valley Regional Planning Commission (DVRPC): avaliada pelas faixas, pela velocidade do tráfego e pelo tipo de ciclofaixa, não por andar em todas as ruas.',
    stressTitle: (level) => `Nível ${level} de 4`,
    stressMeaning: {
      1: 'Tranquilo o bastante para a maioria das pessoas de todas as idades, inclusive crianças.',
      2: 'Bom para a maioria dos adultos: um pouco de estresse de tráfego.',
      3: 'Só ciclistas confiantes se sentem à vontade aqui.',
      4: 'Tráfego intenso e rápido: só os ciclistas mais destemidos.',
    },
    stressOtherWay: (level) => `Andar no outro sentido é mais tranquilo: nível ${level}.`,
    facilities: {
      0: 'Sem ciclofaixa',
      1: 'Uma rota de bicicleta sinalizada',
      2: 'Marcações de faixa compartilhada (sharrows)',
      3: 'Uma ciclofaixa',
      4: 'Uma ciclofaixa com faixa de separação',
      5: 'Uma ciclovia protegida',
      6: 'Uma trilha ou caminho longe do tráfego',
    },
    stressSpeed: (mph) => `O tráfego anda a cerca de ${formatNumber(mph)} milhas por hora, pelo limite de velocidade ou pela estimativa da DVRPC.`,
    stressLanes: (n) => `${pl(n, '# faixa', '# faixas')} no total.`,
    streetsHere: (n) => `${pl(n, '# rua', '# ruas')} aqui`,
    stressDetailsSource: 'Da rede Level of Traffic Stress da DVRPC, avaliada pelas faixas, velocidades e ciclofaixas.',
  },

  landBank: {
    pageTitle: 'O Land Bank em números',
    back: 'Voltar ao mapa',
    intro:
      'Quantos imóveis o Philadelphia Land Bank e os outros órgãos de terras da Prefeitura transferiram, ano a ano, a partir dos registros de escrituras da própria Prefeitura. Só contagens e totais: sem nomes e sem endereços.',
    loading: 'Carregando os números',
    loadFailed: 'Não foi possível carregar os números. Verifique a sua conexão e tente de novo.',
    retry: 'Tentar de novo',
    missing: 'Os números ainda não foram publicados. Eles aparecem depois da próxima atualização semanal dos dados.',
    noStatus: 'Sem status',
    agencyLabel: 'Órgão',
    agencyHelp:
      'Todas as seções abaixo seguem esta escolha, exceto as contagens da própria Prefeitura por programa e a contagem semanal de lotes listados.',
    agencies: {
      all: 'Os quatro órgãos',
      PLB: 'Philadelphia Land Bank',
      PRA: 'Autoridade de Redesenvolvimento',
      PHDC: 'PHDC',
      PUB: 'Prefeitura da Filadélfia',
    },
    agencyLong: {
      all: ALL_AGENCIES,
      PLB: 'o Philadelphia Land Bank',
      PRA: 'a Autoridade de Redesenvolvimento da Filadélfia',
      PHDC: 'a Philadelphia Housing Development Corporation (PHDC)',
      PUB: 'a Prefeitura da Filadélfia',
    },
    headline: (agency, n, deeds, from, to) =>
      `Nos registros de escrituras da Prefeitura de ${from} a ${to}, ${agency} ${agency === ALL_AGENCIES ? 'transferiram' : 'transferiu'} ${pl(n, '# imóvel', '# imóveis')} em ${pl(deeds, '# escritura', '# escrituras')}.`,
    movedAll: (n) =>
      `Não contado: ${pl(n, '# movimentação', '# movimentações')} de um imóvel de um órgão para outro, como da Prefeitura para o Land Bank.`,
    moved: (received, handed) =>
      `Ele também recebeu ${pl(received, '# imóvel', '# imóveis')} dos outros órgãos e passou ${formatNumber(handed)} a eles. Essas movimentações não são contadas como transferências.`,
    whatCounts:
      'Uma transferência aqui é uma escritura de um órgão de terras para alguém fora dos quatro órgãos: uma pessoa, uma empresa, uma organização sem fins lucrativos ou outro órgão público, como a Autoridade de Habitação da Filadélfia. Cada imóvel conta uma vez. Correções, cancelamentos de restrições antigas, movimentações entre os órgãos e acordos registrados como escrituras ficam de fora.',
    partial: (year, date) => `${year} vai só até ${date}: os registros de escrituras da Prefeitura estão cerca de oito semanas atrasados.`,
    noNames: 'Lemos os nomes dos compradores só para distinguir uma pessoa de uma empresa e para conferir a casa ao lado. Não guardamos nenhum deles.',
    showNumbers: 'Mostrar os números',
    tableLabel: (what) => `Os números: ${what}`,
    downloadCsv: 'Baixar CSV',
    year: 'Ano',
    total: 'Total',
    properties: 'Imóveis',
    chartLabel: (what, from, to, max) =>
      `${what}, de ${from} a ${to}. O ano mais alto tem ${max}. Os mesmos números estão na tabela abaixo do gráfico.`,
    perYear: {
      title: 'Transferências por ano',
      caption: 'Imóveis transferidos em cada ano. Uma escritura pode transferir muitos imóveis.',
      deeds: 'Escrituras',
    },
    buyers: {
      title: 'Quem são os compradores',
      caption:
        'O tipo de cada comprador, lido a partir do nome que a escritura registra. Uma organização sem fins lucrativos só é contada como tal quando o nome diz isso; muitas têm nomes como os de empresas e são contadas como empresas.',
      groups: {
        individual: 'Pessoas',
        company: 'Empresas',
        nonprofit: 'Sem fins lucrativos',
        public: 'Outros órgãos públicos',
        unknown: 'Não está claro',
      },
      share: (label, pct) => `${label}: ${pct}%`,
      shares: 'Parcela de todos os imóveis transferidos nestes anos',
    },
    programs: {
      title: 'Por programa',
      caption:
        'As escrituras não dizem por qual programa uma transferência passou. Uma pode ser deduzida: um único lote transferido para uma pessoa que é dona de uma casa encostada nele provavelmente é um quintal lateral ou dos fundos. Este gráfico conta esses lotes, uma dedução nossa. Dos demais não se sabe pelos registros, o que não significa que não fossem quintais laterais.',
      series: 'Quintais laterais ou dos fundos, dedução nossa',
      checked:
        'Como conferimos (9 de outubro de 2026): 10 desses lotes, sorteados entre 2019 e 2026, consultados à mão. Nos 10, o comprador é o proprietário registrado da casa ao lado ou atrás do lote e recebe correspondência lá. Se cada um passou pelo programa de quintal lateral ainda é uma dedução nossa.',
      compare: (cityTotal, ours, oursPlb, from, to) =>
        `Para os anos fiscais de ${from} a ${to}, o painel da própria Prefeitura contou ${formatNumber(cityTotal)} quintais laterais. Pelas escrituras, deduzimos ${formatNumber(ours)} nos quatro órgãos, ${formatNumber(oursPlb)} deles do Land Bank.`,
      cityTitle: 'A contagem da própria Prefeitura por programa',
      cityCaption: (edited) =>
        `Do painel de Land Management (gestão de terras) da Prefeitura, por ano fiscal (de julho a junho). Foi atualizado pela última vez em ${edited}, então o último ano está incompleto, e ele conta casas construídas, não imóveis, para moradia.`,
      fy: 'Ano fiscal',
      sideYards: 'Quintais laterais',
      gardens: 'Jardins ou espaço aberto',
      business: 'Expansão de negócios',
      homesBelow30: 'Casas, abaixo de 30% da renda da área',
      homes60to80: 'Casas, 60% a 80%',
      homes80to120: 'Casas, 80% a 120%',
      homesMarket: 'Casas, a preço de mercado',
      oursPlb: 'Nossa dedução de quintais laterais, Land Bank',
      oursAll: 'Nossa dedução de quintais laterais, os quatro órgãos',
      fyLabel: (fy) => `${fy - 1} a ${fy}`,
    },
    prices: {
      title: 'Preços registrados nas escrituras',
      caption: (max) =>
        `O preço é o que a escritura registra para cada imóvel (a parte dele quando uma escritura cobriu vários). Nem sempre é dinheiro pago: alguns programas vendem por um preço simbólico e protegem o uso do lote com uma hipoteca de 30 anos, e as escrituras de quintal lateral costumam registrar o valor avaliado do lote. O preço mediano tem metade dos preços abaixo e metade acima. "Simbólico" significa ${max} ou menos.`,
      priced: 'Com preço',
      median: 'Preço mediano',
      nominal: 'Preço simbólico',
      none: 'Nenhum preço registrado',
      summary: (median, pct) => `Preço mediano nestes anos: ${median}. ${pct}% foram transferidos por um preço simbólico.`,
    },
    districts: {
      title: 'Por distrito da Câmara Municipal',
      caption:
        'Onde ficam os imóveis, pelas linhas atuais dos distritos da Câmara. As linhas dos distritos mudam depois de cada censo, então os anos anteriores também são colocados pelas linhas de hoje.',
      district: 'Distrito',
      districtName: (n) => `Distrito ${n}`,
      noLocation: 'Sem localização nos registros',
      allYears: 'Todos os anos',
      chartLabel: 'Imóveis transferidos em cada distrito da Câmara. Os mesmos números estão na tabela abaixo.',
    },
    listed: {
      title: 'Lotes listados como disponíveis, semana a semana',
      caption: (from) =>
        `A lista de imóveis públicos da Prefeitura, a mesma que o mapa de imóveis do Land Bank mostra, contada a cada semana em que a nossa cópia dela foi atualizada. A contagem começa em ${from}; não há contagens semanais anteriores.`,
      date: 'Data da lista',
      records: 'Listados como disponíveis',
      parcels: 'Lotes',
      sideYard: 'Aberto a um vizinho como quintal lateral',
      oneWeek: 'Um gráfico aparece quando houver duas semanas para comparar.',
      byStatus: (date) => `Todos os lotes da lista por status, ${date}`,
      status: 'Status',
      count: 'Registros',
      chartLabel: (from, to) => `Lotes listados como disponíveis a cada semana, de ${from} a ${to}. Os mesmos números estão na tabela abaixo.`,
      mapLink: 'O mapa de imóveis listados do Land Bank',
    },
    limits: {
      title: 'O que estes números não podem mostrar',
      items: [
        'Quanto tempo os candidatos esperaram, quantos se candidataram ou quantos foram recusados. Os registros públicos têm escrituras, não pedidos.',
        'O programa por trás da maioria das transferências. As escrituras não dizem; quintais laterais e dos fundos são uma dedução nossa, e as contagens da própria Prefeitura por programa terminam em abril de 2023.',
        'O que foi construído ou plantado depois, ou se as restrições de um lote foram cumpridas.',
        'O que um comprador acabou pagando. Uma escritura registra um preço, e alguns programas combinam um preço simbólico com uma hipoteca de 30 anos.',
        'Terrenos que os órgãos alugam ou cedem por licença, como os acordos de jardim. Nenhuma escritura registra isso.',
        'Escrituras anteriores a 2014 e escrituras das últimas oito semanas, mais ou menos, que a Prefeitura ainda não publicou.',
      ],
    },
    sources: {
      title: 'Fontes e datas',
      deeds: (fetched, last) =>
        `Escrituras: Prefeitura da Filadélfia, Departamento de Registros, transferências de imóveis, lidas em ${fetched}; a escritura mais recente é de ${last}.`,
      programs: (edited) =>
        `Contagens por programa: Prefeitura da Filadélfia, Departamento de Planejamento e Desenvolvimento, painel de Land Management, atualizado pela última vez em ${edited}.`,
      listed:
        'Lotes listados: Prefeitura da Filadélfia, Departamento de Planejamento e Desenvolvimento (Land Management), como o mapa de imóveis do Philadelphia Land Bank os mostra.',
      districts: 'Distritos da Câmara Municipal: Prefeitura da Filadélfia, linhas de hoje.',
      neighbours:
        'Para a dedução de quintais laterais: a lista de proprietários da Prefeitura (Gabinete de Avaliação de Propriedades, OPA) e os formatos dos lotes (Departamento de Águas).',
      board: 'As pautas da diretoria do Land Bank, que listam cada transferência por programa',
      council: 'A legislação da Câmara Municipal, onde a Câmara aprova cada transferência do Land Bank',
      method: 'Como contamos, em detalhe',
      deedsLink: 'As transferências de imóveis da Prefeitura',
      programsLink: 'A tabela do painel de Land Management da Prefeitura',
    },
    csv: {
      years: (agency) => `Transferências por ano e por órgão (os quatro órgãos e cada um; esta página mostrava ${agency}).`,
      districts: 'Transferências por distrito da Câmara Municipal (linhas de hoje) e por ano, para os quatro órgãos e para cada um.',
      programs: 'As contagens da própria Prefeitura por programa e ano fiscal, ao lado da nossa dedução de quintais laterais.',
      listed: 'Lotes na lista de imóveis públicos da Prefeitura listados como disponíveis, a cada semana desde o início da contagem.',
      counts: 'Só contagens: sem nomes, sem endereços e sem números de lote.',
      dates: (fetched, last) => `Escrituras lidas em ${fetched}; a escritura mais recente é de ${last}.`,
      file: (part, day) => `placekeepers-land-bank-${part}-${day}.csv`,
    },
  },

  basemap: {
    missing: 'O mapa base não está disponível, então as ruas e os nomes de lugares ficam ocultos. As camadas de dados continuam funcionando.',
    unavailable: 'O mapa base não está disponível aqui, então o mapa mostra um fundo liso.',
    legend: 'Ruas, prédios, parques, água e nomes de lugares, em cores.',
    legendMuted: 'Ruas, prédios, parques, água e nomes de lugares, em cinza, para que os dados se destaquem.',
  },

  credits: {
    basemap:
      '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    data: (statusUrl) => `Dados: Prefeitura da Filadélfia e <a href="${statusUrl}">outros</a>`,
  },

  status: {
    pageTitle: 'Status dos dados',
    intro:
      'O Placekeepers atualiza os seus dados toda semana. Se uma fonte falhar, o mapa mantém a última cópia boa e avisa aqui.',
    back: 'Voltar ao mapa',
    loading: 'Carregando o status dos dados',
    loadFailed: 'Não conseguimos carregar o arquivo de status dos dados. O mapa ainda pode funcionar com dados mais antigos.',
    retry: 'Tentar de novo',
    builtOn: (date) => `Última atualização: ${date}`,
    buildId: (id) => `Build ${id}`,
    summaryAllOk: 'Todas as fontes estão em dia.',
    summary: (stale, failing, missing) => {
      const parts: string[] = [];
      if (stale) parts.push(pl(stale, '# fonte está desatualizada', '# fontes estão desatualizadas'));
      if (failing) parts.push(pl(failing, '# fonte não está funcionando', '# fontes não estão funcionando'));
      if (missing) parts.push(pl(missing, '# fonte ainda não foi buscada', '# fontes ainda não foram buscadas'));
      return `${parts.join(', ')}.`;
    },
    statusLabel: {
      ok: 'Em dia',
      stale: 'Desatualizada',
      failing: 'Não funciona',
      missing: 'Ainda não buscada',
      unknown: 'Desconhecido',
    },
    staleSince: (date) => `Usando a última cópia boa, de ${date}.`,
    staleNoDate: 'Usando a última cópia boa.',
    failingText: 'Não há nenhuma cópia utilizável agora, então camadas que dependem dela podem estar faltando.',
    missingText: 'Esta fonte ainda não foi buscada.',
    unknownText: 'O arquivo de status informa algo que não reconhecemos.',
    lastSuccess: (date) => `Último download bom: ${date}`,
    neverSucceeded: 'Nenhum download bom ainda',
    lastAttempt: (date) => `Última tentativa: ${date}`,
    rows: (n) => `${pl(n, '# registro', '# registros')}`,
    newest: (date) => `Registro mais recente: ${date}`,
    message: (text) => `Nota da atualização: ${text}`,
    publisher: 'Publicado por',
    homepage: 'De onde vem',
    license: 'Licença',
    cadence: {
      daily: 'Atualizado todo dia pelo publicador',
      weekly: 'Atualizado toda semana pelo publicador',
      monthly: 'Atualizado todo mês pelo publicador',
      yearly: 'Atualizado todo ano pelo publicador',
      irregular: 'Atualizado de vez em quando pelo publicador',
      frozen: 'Não é mais atualizado pelo publicador',
    },
    problems: 'Problemas no arquivo de status',
    notesTitle: 'Notas da última atualização',
    notesInEnglish: 'Estas notas estão escritas em inglês, para as pessoas que mantêm o mapa funcionando.',
    basemapLabel: { ok: 'Em dia', failing: 'Não disponível' },
    basemapMade: (date) =>
      `A atualização semanal faz uma nova cópia do mapa base cerca de uma vez por mês. Esta cópia foi feita a partir do OpenStreetMap em ${date}.`,
    basemapNoDate: 'A atualização semanal faz uma nova cópia do mapa base cerca de uma vez por mês.',
    basemapMissing: 'O mapa base não está disponível nesta cópia do site, então o mapa mostra um fundo liso. As camadas de dados continuam funcionando.',
  },

  search: {
    label: 'Buscar um endereço, um cruzamento ou um número de lote',
    placeholder: 'Endereço, cruzamento ou número de lote',
    button: 'Buscar',
    searching: 'Buscando',
    tooShort: 'Digite um endereço, como 1234 Market St, ou duas ruas que se cruzam, como Broad e Girard.',
    notFound:
      'A Prefeitura não encontrou esse lugar. Tente um número de casa e uma rua, duas ruas que se cruzam ou um número de lote de nove dígitos.',
    failed: (reason) => `Não deu certo com o serviço de endereços da Prefeitura: ${reason}. Tente de novo daqui a pouco.`,
    liveOff:
      'A busca de endereços consulta o serviço de endereços da Prefeitura, e os dados ao vivo da Prefeitura estão desativados em Configurações. Você ainda pode buscar por um número de lote de nove dígitos.',
    resultsTitle: 'Escolha um lugar',
    resultsCount: (n) => pl(n, '# lugar corresponde', '# lugares correspondem'),
    intersection: 'Cruzamento',
    showing: (label) => `Mostrando ${label} no mapa.`,
    noParcel: (label) => `Mostrando ${label} no mapa. A Prefeitura não tem registro de lote para este endereço exato.`,
    privacy: 'As buscas vão do seu navegador direto para a Prefeitura da Filadélfia.',
  },

  pick: {
    looking: 'Consultando este lote na Prefeitura',
    nothing: 'A Prefeitura não tem nenhum lote neste ponto. Toque em um lote ou em um prédio.',
    liveOff: 'Para abrir um lote que não está na nossa lista, ative "Buscar dados ao vivo da Prefeitura" em Configurações.',
    failed: (reason) => `Não deu certo com o mapa de lotes da Prefeitura: ${reason}. Tente de novo daqui a pouco.`,
  },

  historic: {
    liveOff:
      'Estas imagens vêm direto dos servidores da Prefeitura, então só podem ser ativadas enquanto "Buscar dados ao vivo da Prefeitura" estiver ativado (em Configurações, em "Privacidade e dados ao vivo").',
    refused:
      'As fotos aéreas antigas e o atlas de 1860 vêm dos servidores da Prefeitura. Ative os dados ao vivo da Prefeitura em Configurações para vê-los.',
    serverError: 'O servidor de imagens da Prefeitura não enviou todas as partes desta imagem. Tente de novo mais tarde.',
    photoYear: (year) => `A foto aérea de ${year}, tirada de um avião.`,
    gaps1975: 'As fotos de 1975 deixam falhas no extremo sul da cidade, em volta do aeroporto e do Navy Yard.',
    termsNotStated:
      'O publicador não declara termos de uso para estas fotos; elas são mostradas como a Prefeitura as hospeda, com crédito, e saem do ar se o publicador pedir.',
    blackAndWhite: (year) => `As fotos de ${year} são em preto e branco.`,
    under: 'A foto fica sob todas as outras camadas. Diminua a intensidade dela para ver as ruas de hoje através dela.',
    atlasCoverage: 'O atlas cobre só o Center City e o Northern Liberties.',
    atlasCredit:
      'Atlas ajustado ao mapa de hoje pela Greater Philadelphia GeoHistory Network e hospedado pela Prefeitura da Filadélfia com a permissão dela.',
    sliderRange: (first, last) => `De ${first} a ${last}`,
    lotTitle: 'Fotos aéreas antigas',
    lotButton: 'Ver este lote em fotos aéreas antigas',
    lotHelp: (year) =>
      `Abre o mapa neste lote com a foto aérea de ${year}, a mais antiga deste mapa. Passe pelos anos desde então em "Antes e agora", nas camadas.`,
    lotLiveOff: 'As fotos vêm direto dos servidores da Prefeitura, então precisam dos dados ao vivo da Prefeitura, que estão desativados.',
    shown: (year) => `As fotos aéreas de ${year} estão ativadas. Passe pelos anos em "Antes e agora", nas camadas.`,
    statusOk:
      'Todos os serviços de imagem responderam na última verificação semanal. As imagens carregam direto dos servidores da Prefeitura quando alguém ativa a camada delas.',
    statusStale: (date) =>
      `Na última verificação semanal, nem todos os serviços de imagem responderam, então algumas imagens podem não aparecer. Cada um respondeu pela última vez em ${date}.`,
    statusFailing: 'Os serviços de imagem não responderam na verificação semanal, então as imagens podem não aparecer.',
    services: (n) => pl(n, '# serviço de imagem verificado', '# serviços de imagem verificados'),
    lastCheck: (date) => `Última verificação em que todos os serviços responderam: ${date}`,
  },

  redlining: {
    detailsTitle: 'Mapa de redlining de 1937',
    grades: {
      A: 'A, classificada como "melhor" em 1937',
      B: 'B, classificada como "ainda desejável"',
      C: 'C, classificada como "definitivamente em declínio"',
      D: 'D, classificada como "perigosa" e contornada em vermelho: marcada pelo redlining',
    },
    ungraded: 'Sem classificação (terrenos industriais e comerciais)',
    area: (label, grade) => `Área ${label}, classificada como ${grade} em 1937`,
    areaUngraded: (label) => `${label}: uma área que o mapa de 1937 deixou sem classificação`,
    context:
      "Em 1937, uma agência federal, a Home Owners' Loan Corporation, classificou os bairros da cidade de A a D conforme o quanto considerava seguro conceder financiamento imobiliário ali. As classificações se apoiavam em quem morava em cada área: as áreas onde moravam famílias negras e muitas famílias imigrantes costumavam receber D e ser contornadas em vermelho. Por décadas foi mais difícil conseguir crédito ali, e essa prática se chama redlining.",
    notToday: 'As classificações são um registro de como uma agência federal julgava os lugares em 1937. Elas não dizem nada sobre as pessoas que moram lá hoje.',
    legendTap: 'Toque em uma área para ver a classificação dela e um link para a descrição de 1937.',
    description: (label) => `Leia a descrição de 1937 da área ${label} no Mapping Inequality`,
    descriptionNote: 'As descrições de 1937 não são copiadas aqui: elas ficam no Mapping Inequality, com a história em volta delas.',
    credit:
      'Áreas e classificações do Mapping Inequality: Redlining in New Deal America, de Robert K. Nelson, LaDale Winling e outros, University of Richmond Digital Scholarship Lab. O Placekeepers mostra apenas as áreas e as classificações.',
    homepageLabel: 'Mapping Inequality: Filadélfia',
    nonCommercial:
      'Somente para uso não comercial. Licenciado sob Creative Commons Attribution NonCommercial 2.5, à parte do restante dos dados do mapa.',
    licenseLabel: 'CC BY-NC 2.5',
    statusNote:
      'Somente para uso não comercial: esta fonte é licenciada para uso não comercial, então o site a publica em um arquivo próprio e nunca em um download.',
  },

  options: {
    title: 'Privacidade e dados ao vivo',
    privacyLink: 'Como o Placekeepers cuida da sua privacidade',
    turnOn: 'Ativar os dados ao vivo da Prefeitura',
    resetNote: 'A sua escolha sobre os dados ao vivo da Prefeitura não muda.',
  },

  failure: {
    timeout: 'a resposta demorou demais',
    network: 'não foi possível conectar',
    http: 'a resposta veio com um erro',
    bad_data: 'a resposta veio em um formato que não conseguimos ler',
    not_found: 'não há registro disso',
    aborted: 'a consulta não foi feita',
    empty: 'a consulta não foi feita',
  },

  rulesMap: {
    legend: {
      district: 'Distrito histórico',
      property: 'No registro histórico',
      overlay: 'Zoneamento sobreposto',
      supplemental: 'Outra regra especial do Código de Zoneamento',
      hearingZoning: 'Audiência de zoneamento',
      hearingOther: 'Audiência perante outro conselho',
      brownfield: 'Área de brownfield da EPA',
    },
    notes: {
      historic: 'Mudanças aqui podem precisar da análise da Comissão Histórica (Historical Commission); consulte-a primeiro.',
      overlays: 'Os zoneamentos sobrepostos se cruzam, e alguns cobrem a maior parte da cidade. Toque em um ponto para ver todos os que existem ali.',
      hearings: 'Toque em uma audiência para ver como participar e para abrir a página do lote.',
      brownfields: 'Não é um mapa de todo terreno contaminado. Teste o solo antes de plantar alimentos em uma dessas áreas ou perto dela.',
    },
    districtTitle: (name) => name,
    designated: (date) => `Designado em ${date}.`,
    noDate: 'A camada da Prefeitura não informa o dia da designação.',
    propertyTitle: 'No Registro de Lugares Históricos da Filadélfia',
    listedOn: (date) => `Listado individualmente em ${date}.`,
    listedAlone: 'Listado individualmente.',
    inDistrict: (district, date) => `Parte de ${district}${date ? `, designado em ${date}` : ''}.`,
    overlaysHere: (n) => (n === 1 ? 'Um zoneamento sobreposto aqui' : `${formatNumber(n)} zoneamentos sobrepostos aqui`),
    hearingTitle: (board) => `Audiência (${board})`,
    hearingWhen: (date, time) => `${date}${time ? `, às ${time}` : ''}`,
    hearingsHere: (n) => `${pl(n, '# audiência', '# audiências')} aqui`,
    about: (address) => `Sobre ${address}.`,
    rco: (name) => `Organização comunitária registrada notificada: ${name}.`,
    openLot: 'Abrir a página deste lote',
    namesNote: 'Quem entrou com o recurso é mostrado só na página do lote.',
    brownfieldTitle: 'Área de brownfield da EPA',
  },

  dossier: {
    pageTitle: 'Página do lote',
    loading: 'Carregando a página do lote',
    parcel: (opa) => `Conta OPA ${opa}`,
    printButton: 'Imprimir esta página do lote',
    showOnMap: 'Mostrar no mapa',
    close: 'Fechar a página do lote',
    clear: 'Limpar a seleção',
    retry: 'Tentar a Prefeitura de novo',
    notFound: 'Não conseguimos encontrar este lote nos registros da Prefeitura nem na nossa cópia semanal.',
    noData:
      'Este lote não está na nossa cópia semanal, e os dados ao vivo da Prefeitura estão desativados, então ainda não há nada para mostrar.',
    sections: {
      summary: 'Resumo',
      actions: 'O que você pode fazer',
      rules: 'Regras para este lote',
      owner: 'De quem é',
      history: 'Histórico',
      nearby: 'Por perto',
      sources: 'Fontes e atualização',
    },
    contents: 'Nesta página',

    provenance: {
      live: (time) => `Ao vivo da Prefeitura às ${time}.`,
      snapshot: (date) => `Da cópia semanal de ${date}.`,
      snapshotNoDate: 'Da cópia semanal.',
      map: 'Dos dados semanais do mapa.',
      checking: 'Verificando se a Prefeitura tem registros mais novos.',
      asking: 'Perguntando à Prefeitura.',
      failedSnapshot: (reason, date) => `Não deu certo com os servidores da Prefeitura (${reason}), então esta é a cópia semanal de ${date}.`,
      failedNothing: (reason) => `Não deu certo com os servidores da Prefeitura (${reason}), então esta parte não pode ser mostrada agora.`,
      offSnapshot: (date) => `Os dados ao vivo da Prefeitura estão desativados, então esta é a cópia semanal de ${date}.`,
      offNothing: 'Os dados ao vivo da Prefeitura estão desativados, e a nossa cópia semanal não cobre esta parte.',
      none: 'Nenhum registro para mostrar.',
    },
    banner: {
      live: 'Ao vivo da Prefeitura da Filadélfia.',
      loading: 'Consultando a Prefeitura para obter os registros mais novos.',
      off: (date) => `Os dados ao vivo da Prefeitura estão desativados. Esta página mostra a cópia semanal de ${date}.`,
      offNoDate: 'Os dados ao vivo da Prefeitura estão desativados. Esta página mostra a cópia semanal.',
      partial: 'Algumas consultas à Prefeitura não funcionaram. Essas partes mostram a cópia semanal, ou nada, e dizem isso.',
      failed: 'Os servidores da Prefeitura não responderam. Esta página mostra o que a nossa cópia semanal tem.',
    },

    summary: {
      kind: { lot: 'Lote vazio', building: 'Prédio vazio' },
      notListed: 'Não está na nossa lista de lotes e prédios vazios',
      notListedHelp: 'Se você acha que este lote está vazio, informe uma correção abaixo.',
      noDetails: 'Ainda sem detalhes publicados',
      noPublishedDetails: 'Não publicamos detalhes deste lote, então esta página mostra o que os servidores da Prefeitura dizem agora.',
      confidence: {
        high: 'Muito provavelmente vazio',
        medium: 'Provavelmente vazio',
        low: 'Não temos muita certeza de que está vazio',
      },
      confidenceTitle: 'Quanta certeza temos',
      signals: (n) =>
        `${pl(n, '# registro independente da Prefeitura concorda', '# registros independentes da Prefeitura concordam')} que está vazio.`,
      cityCalls: (category) => `Os registros de imóveis da Prefeitura o classificam como: ${category}.`,
      lotSize: (frontage, depth) =>
        `A avaliação de imóveis da Prefeitura registra cerca de ${formatNumber(Math.round(frontage))} pés de frente para a rua e ${formatNumber(Math.round(depth))} pés de profundidade.`,
      landcare: 'Já mantido pelo PHS LandCare.',
      landcareSince: (year) => `Já mantido pelo PHS LandCare desde ${year}.`,
      garden: 'Já há pessoas cultivando aqui. Pergunte a elas antes de planejar qualquer coisa.',
      lensLine: (lens) => `Prioridade na lente de ${lens.toLowerCase()}, a lente pela qual o mapa colore os lotes.`,
      flood: {
        1: 'Parte deste lote fica na planície de inundação da FEMA com 1 por cento de chance por ano, onde uma enchente tem pelo menos 1 chance em 100 a cada ano. Isso é um motivo para cuidado, não parte de nenhuma pontuação: as plantas aqui precisam aguentar solo encharcado, qualquer construção precisa seguir as regras da Prefeitura para planícies de inundação, e criar áreas verdes que absorvem a chuva ajuda.',
        2: 'Parte deste lote fica na área da FEMA com 0,2 por cento de chance de enchente por ano, onde uma enchente tem 1 chance em 500 a cada ano. Isso é um motivo para cuidado, não parte de nenhuma pontuação: as plantas aqui devem aguentar solo encharcado, e criar áreas verdes que absorvem a chuva ajuda.',
      },
      floodTitle: 'Risco de enchente',
      linksTitle: 'Veja em outros sites',
      propertyPage: 'A página de imóveis da Prefeitura',
      atlas: 'Atlas, o mapa da Prefeitura para este endereço',
      googleMaps: 'Google Maps',
      streetView: 'Google Street View',
      linksNote: 'Estes links abrem outros sites. O Placekeepers aponta para fotos de rua, mas nunca as copia.',
    },

    actions: {
      intro: 'Comece pelo caminho legal. Cada um diz quem pode fazer e quem pode ajudar.',
      route: 'O caminho legal',
      steps: 'Passos',
      who: 'Quem pode fazer',
      cost: 'Custo',
      timeline: 'Quanto tempo leva',
      lastChecked: (date) => `Verificado pela última vez em ${date}.`,
      toConfirm: 'Ainda a confirmar com a organização citada aqui.',
      partners: 'Quem pode ajudar',
      otherRoutes: 'Outros caminhos legais para este lote',
      none: 'Ainda não há sugestão para este lugar.',
      notListed:
        'Este lote não está na nossa lista de prováveis lotes e prédios vazios, então não temos sugestão para ele. A página Como fazer explica os caminhos legais para qualquer lote.',
      howTo: 'Como fazer',
      conservatorshipWarning:
        'A administração judicial (conservatorship) pode tirar um imóvel do seu proprietário. Pesquisadores constataram que ela é usada de forma desproporcional em bairros que enfrentam gentrificação. Converse com a Garden Justice Legal Initiative antes de considerá-la.',
      notLegalAdvice: 'O Placekeepers não é aconselhamento jurídico. Confira com as organizações citadas aqui antes de agir.',
    },

    listing: {
      title: 'Consta como disponível na lista dos órgãos de terras da Prefeitura',
      text: (date) => `Em ${date}, a lista de terras públicas da Prefeitura mostrava este imóvel como disponível.`,
      textNoDate: 'A lista de terras públicas da Prefeitura mostra este imóvel como disponível.',
      variants: {
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': 'Ele é oferecido para um acordo de jardim.',
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': 'Nada pode ser construído nele.',
        'OWNED - AVAILABLE (NOT FOR SY)': 'Ele não é oferecido como quintal lateral.',
      },
      sideYardLead: 'Se você é proprietário da casa ao lado, comece pelo programa de quintal lateral:',
      decline:
        'Estar na lista não significa que o Land Bank vá dizer sim. Ele decide cada pedido por conta própria e pode recusar qualquer venda ou arrendamento, mesmo de um imóvel que lista como disponível.',
      changes: 'A lista muda com frequência. Confira o mapa do Land Bank antes de agir.',
      map: 'O mapa de imóveis disponíveis do Land Bank',
      credit:
        'Lista: Prefeitura da Filadélfia, Departamento de Planejamento e Desenvolvimento (Land Management), como o mapa do Philadelphia Land Bank a mostra.',
    },


    ownerType: {
      noName: 'Os registros da Prefeitura não trazem o nome do proprietário.',
      unclear: 'Não conseguimos saber que tipo de proprietário é pelo nome.',
      individual: 'O nome do proprietário parece o nome de uma pessoa.',
      publicName: (label) => `Os registros da Prefeitura indicam ${label} como proprietário.`,
      markerReason: (marker) => `O nome do proprietário inclui "${marker}".`,
      agencyConflict: (contact) => `Os registros de imóveis da Prefeitura indicam outro proprietário, então confirme com ${contact} qual é o atual.`,
      agencyContacts: { PUB: 'o Land Bank', PLB: 'o Land Bank', PRA: 'a PHDC', PHDC: 'a PHDC' },
      publicBodies: {
        land_bank: 'o Philadelphia Land Bank',
        redevelopment_authority: 'a Autoridade de Redesenvolvimento da Filadélfia',
        pha: 'a Autoridade de Habitação da Filadélfia',
        housing_authority: 'uma autoridade de habitação',
        phdc: 'a Philadelphia Housing Development Corporation (PHDC)',
        pha_or_phdc: 'a Autoridade de Habitação da Filadélfia ou a PHDC (o nome está cortado)',
        city: 'a Prefeitura da Filadélfia',
        school_district: 'o Distrito Escolar da Filadélfia',
        community_college: 'o Community College of Philadelphia',
        septa: 'a SEPTA',
        commonwealth: 'o estado da Pensilvânia (Commonwealth of Pennsylvania)',
        phfa: 'a Pennsylvania Housing Finance Agency',
        united_states: 'o governo dos Estados Unidos',
        hud: 'o Departamento de Habitação e Desenvolvimento Urbano dos EUA (HUD)',
        veterans_affairs: 'o Departamento de Assuntos de Veteranos dos EUA',
        paid: 'a Philadelphia Authority for Industrial Development',
        port_authority: 'a Philadelphia Regional Port Authority',
        district_attorney: 'a Promotoria (District Attorney) da Filadélfia',
        public_authority: 'uma autoridade pública',
        pgw: 'a Philadelphia Gas Works',
      },
      markers: {
        TR: 'TR, abreviação de trustee (administrador fiduciário)',
        TRS: 'TRS, abreviação de trustees',
        TRST: 'TRST, abreviação de trust (fideicomisso)',
        'T U W': 'T/U/W, um fideicomisso criado por testamento',
        FBO: 'FBO, em benefício de (for the benefit of)',
        CO: 'CO, abreviação de company (empresa)',
        LP: 'LP, uma sociedade limitada (limited partnership)',
        LLP: 'LLP, uma sociedade de responsabilidade limitada (limited liability partnership)',
        LTD: 'LTD, abreviação de limited',
        LL: 'LL, uma forma abreviada de LLC',
        GP: 'GP, um sócio geral (general partner)',
        'N A': 'N A, um banco nacional (national bank)',
        FB: 'FB, uma forma abreviada de FBO',
        CDC: 'CDC, uma corporação de desenvolvimento comunitário (community development corporation)',
      },
      labels: {
        individual: 'Uma pessoa',
        company: 'Uma empresa',
        city: 'A Prefeitura da Filadélfia',
        land_bank: 'O Philadelphia Land Bank',
        redevelopment_authority: 'A Autoridade de Redesenvolvimento da Filadélfia',
        housing_authority: 'Uma autoridade de habitação',
        nonprofit: 'Uma organização sem fins lucrativos',
        other_public: 'Outro órgão público',
        unknown: 'Não está claro nos registros da Prefeitura',
      },
    },

    owner: {
      names: 'Proprietário, como a Prefeitura publica',
      noNames: 'Os registros da Prefeitura não trazem o nome do proprietário.',
      mailing: 'Endereço de correspondência, como a Prefeitura publica',
      noMailing: 'Nenhum endereço de correspondência registrado.',
      type: 'Tipo de proprietário',
      flagsTitle: 'O que os registros da Prefeitura sugerem',
      noFlags: 'Nada nos registros da Prefeitura pede uma nota sobre este proprietário.',
      heldBack:
        'Não temos certeza de que este lote está vazio, então pode ser a casa de alguém. As notas sobre um proprietário que pode ser uma pessoa (onde recebe correspondência, um possível espólio, dívida de impostos, outros lotes que possui) só aparecem em lotes que consideramos muito provavelmente ou provavelmente vazios.',
      ownerChanged:
        'Os registros da Prefeitura indicam um proprietário diferente do que a nossa cópia semanal indicava, então as notas que eram sobre o proprietário anterior ficam de fora.',
      parts: { meaning: 'O que significa', careful: 'Tenha cuidado', next: 'Um próximo passo cuidadoso' },
      flagTitles: {
        absentee: 'Onde o proprietário recebe correspondência',
        possible_estate: 'Possível espólio',
        tax_debt_2025: 'Dívida de impostos em julho de 2025',
        sheriff_sales: 'Leilões do xerife anteriores',
        years_since_sale: 'Anos desde a última venda',
        many_parcels: 'Proprietário de muitos lotes vazios',
        fast_resales: 'Revendas rápidas',
        open_violations: 'Infrações abertas do L&I',
        unsafe: 'Prédio inseguro',
        imminently_dangerous: 'Prédio em perigo iminente',
      },
      otherFlag: 'Uma nota dos registros da Prefeitura',
      taxTitle: 'Impostos',
      taxNoDebt:
        'A Prefeitura não publica mais o saldo de impostos de cada imóvel como dados abertos. A cópia de julho de 2025 que temos não mostra impostos em atraso aqui.',
      taxUnknown: 'A Prefeitura não publica mais o saldo de impostos de cada imóvel como dados abertos.',
      taxHeld:
        'A Prefeitura não publica mais o saldo de impostos de cada imóvel como dados abertos. A nossa cópia de julho de 2025 é mostrada, para um proprietário que pode ser uma pessoa, só em lotes que consideramos muito provavelmente ou provavelmente vazios.',
      taxCenter: 'Consulte o saldo de hoje no Tax Center da Prefeitura',
      deedFraudTitle: 'Proteja este imóvel contra o roubo de escritura',
      deedFraud:
        'O roubo de escritura acontece quando alguém registra uma escritura falsa para tomar um imóvel, muitas vezes um cujo proprietário morreu ou mora em outro lugar. Proprietários e famílias podem se inscrever nos alertas gratuitos do Fraud Guard da Prefeitura, que enviam um e-mail quando um documento com o nome deles é registrado. Desde novembro de 2025, a Prefeitura também bloqueia automaticamente escrituras cujo vendedor já tinha morrido na data em que supostamente assinou.',
      fraudGuard: 'Inscreva-se nos alertas gratuitos do Fraud Guard da Prefeitura',
      deedCheck: 'A verificação automática da Prefeitura que impede a fraude de escritura',
      helpTitle: 'Ajuda para proprietários e famílias',
      seeList: 'Ver os lotes deste proprietário na nossa lista',
      cityListTitle: 'Lista de imóveis públicos da Prefeitura',
      cityList: 'O lote está na lista de imóveis públicos da Prefeitura.',
      cityListNames: (agency) => `A lista de imóveis públicos da Prefeitura indica ${agency} como proprietário.`,
      cityListStatus: (status) => `Situação dele na lista: ${status}.`,
      cityStatuses: {
        'OWNED - AVAILABLE': ['listado como disponível', 'O Land Bank mostra o imóvel no seu mapa de imóveis para os quais as pessoas podem se candidatar.'],
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': [
          'listado como disponível para um acordo de jardim',
          'É oferecido para jardinagem mediante um acordo com o Land Bank.',
        ],
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': [
          'listado como disponível, sem construção permitida',
          'É oferecido, mas nada pode ser construído nele.',
        ],
        'OWNED - AVAILABLE (NOT FOR SY)': [
          'listado como disponível, mas não como quintal lateral',
          'É oferecido, mas não ao vizinho da casa ao lado como quintal lateral.',
        ],
        'OWNED - ON HOLD FOR AHD': [
          'reservado para moradia acessível',
          'Está reservado para moradias acessíveis, então não é oferecido aos vizinhos agora.',
        ],
        'OWNED - NOT AVAILABLE': ['indisponível', 'Os órgãos de terras da Prefeitura não o estão oferecendo agora.'],
        'OWNED - PROCESSING APPLICANT, NOT AVAILABLE': [
          'alguém se candidatou',
          'Um pedido para ele está em análise, então ele não é oferecido a mais ninguém agora.',
        ],
        'OWNED - MANAGED AND NOT AVAILABLE': ['administrado e indisponível', 'Um órgão cuida dele e não o está oferecendo.'],
        'OWNED - ON HOLD': ['em espera', 'Não é oferecido por enquanto.'],
        'OWNED - SALE PENDING': ['venda pendente', 'Uma venda está em andamento, então ele não é oferecido a mais ninguém.'],
        'UNKNOWN - RESEARCH PENDING': ['ainda não se sabe', 'Os órgãos de terras da Prefeitura ainda estão pesquisando o caso.'],
        'OWNED - RFP RELEASED': ['oferecido para desenvolvimento', 'Os órgãos de terras da Prefeitura pediram propostas para desenvolvê-lo.'],
        'OWNED - ON HOLD FOR HOME SD': [
          'reservado para um programa de moradia',
          'Está reservado para um programa que a lista chama de HOME SD, então não é oferecido aos vizinhos agora.',
        ],
        'OWNED - HELD FOR CITY COUNCIL MEMBER': [
          'reservado para o vereador do distrito',
          'Está reservado para o vereador do distrito, então não é oferecido agora. O gabinete dele pode explicar por quê.',
        ],
        'OWNED - TO BE FEATURED SOON': ['será oferecido em breve', 'Os órgãos de terras da Prefeitura planejam oferecê-lo em breve.'],
        'OWNED - NOT AVAILABLE (GSI PROJECT)': [
          'reservado para obras verdes de águas pluviais',
          'Está reservado para plantios que o Departamento de Águas constrói para absorver a chuva.',
        ],
        'OWNED - COMPETITIVE BID POSTED': ['oferecido por concorrência', 'Os órgãos de terras da Prefeitura abriram uma concorrência para ele.'],
      },
      sideYard: 'A Prefeitura o marca como elegível para o programa de quintal lateral, para o proprietário da casa ao lado.',
      agencies: {
        PUB: 'a Prefeitura da Filadélfia',
        PLB: 'o Philadelphia Land Bank',
        PRA: 'a Autoridade de Redesenvolvimento da Filadélfia',
        PHDC: 'a Philadelphia Housing Development Corporation (PHDC)',
      },
      tangledTitle: 'O Tangled Title Fund, administrado pela Philadelphia VIP',
      sheriffGuide: 'Grounded in Philly: leilões do xerife',
      gjli: 'A Garden Justice Legal Initiative, para ajuda jurídica gratuita',
    },

    flags: {
      absentee: {
        outOfState: (where) => `O proprietário recebe correspondência em outro lugar: ${where} (fora do estado).`,
        outsidePennsylvania: 'O proprietário recebe correspondência em outro lugar: fora da Pensilvânia.',
        outsideCity: (city) => `O proprietário recebe correspondência em outro lugar: ${city}, PA (fora da Filadélfia).`,
        outsideCityUnknown: 'O proprietário recebe correspondência em outro lugar: fora da Filadélfia.',
        poBox: 'O proprietário recebe correspondência em outro lugar: uma caixa postal na Filadélfia.',
        elsewhere: 'O proprietário recebe correspondência em outro lugar: outro endereço na Filadélfia.',
        careful:
          'Este é o endereço para onde a Prefeitura envia as contas de impostos. Ele pode estar desatualizado, ou pertencer a um parente, um advogado ou um administrador, e um proprietário que mora em outro lugar pode não saber como o imóvel está hoje.',
        next: 'Escreva ao proprietário neste endereço para pedir permissão antes de fazer qualquer coisa no imóvel, e peça à Garden Justice Legal Initiative que revise qualquer acordo antes de você assinar.',
      },
      possible_estate: {
        text: 'O proprietário registrado pode ter morrido.',
        careful: 'Familiares ainda podem ter direito a este imóvel e podem não saber disso.',
        next: 'Se você conhece a família, o Tangled Title Fund (até US$ 6.500 em ajuda jurídica) e a Philadelphia VIP podem ajudá-la a ficar com ele. As famílias também podem se inscrever nos alertas gratuitos do Fraud Guard da Prefeitura.',
      },
      tax_debt_2025: {
        text: (amount, years) =>
          `Em julho de 2025, os registros da Prefeitura mostravam ${amount} em impostos imobiliários em atraso${years ? `, referentes a ${pl(years, '# ano', '# anos')}` : ''}.`,
        careful:
          'Este é o último registro público, de 9 de julho de 2025, não o saldo de hoje: o proprietário pode ter pago desde então, ou dever mais. Cerca de três anos ou mais de impostos em atraso podem levar a um leilão do xerife, em que um lote cuidado pelos vizinhos pode ser vendido a um comprador de fora.',
        next: 'Consulte o saldo de hoje no Tax Center da Prefeitura antes de confiar nisto. Se o seu quarteirão cuida deste lote, o guia do Grounded in Philly sobre leilões do xerife explica o risco e o que você pode fazer.',
      },
      sheriff_sales: {
        one: (sale) => `Vendido em leilão do xerife em ${sale}.`,
        many: (n, sales) => `Vendido em leilão do xerife ${n} vezes: ${sales}.`,
        sale: (date, price) => (price ? `${date}, por ${price}` : date),
        andLast: (others, last) => `${others}; e ${last}`,
        careful:
          'Em um leilão do xerife, o lance vencedor extingue as dívidas antigas do imóvel, então um lote cuidado pelos vizinhos pode passar para um comprador de fora. Uma venda anterior não significa que o imóvel esteja à venda agora.',
        next: 'Se o seu quarteirão cuida deste lote, leia o guia do Grounded in Philly sobre leilões do xerife e peça ajuda jurídica gratuita à Garden Justice Legal Initiative.',
      },
      years_since_sale: {
        lastSold: (year) => `Vendido pela última vez em ${year}.`,
        notSoldSince: (year) => `Não vendido no mercado aberto desde pelo menos ${year}.`,
        careful:
          'Vendas por preço simbólico e leilões do xerife ficam de fora aqui; o histórico completo está abaixo. Muitas casas passam de geração em geração nas famílias sem uma nova venda, então muito tempo sem venda não significa que o proprietário tenha desistido do imóvel.',
        next: 'Se uma família herdou o imóvel sem uma nova escritura, o Tangled Title Fund e a Philadelphia VIP podem ajudá-la a regularizar o título e ficar com o imóvel.',
      },
      many_parcels: {
        text: (n) => `Este proprietário possui ${n} lotes vazios na cidade.`,
        careful:
          'Associamos proprietários pelo nome exato nos registros da Prefeitura, então um proprietário pode aparecer com várias grafias e dois proprietários podem ter o mesmo nome. Possuir terrenos vazios não é, por si só, uma irregularidade.',
        next: 'Use a lista para ver os outros lotes deste proprietário e depois peça permissão da forma legal: escreva ao proprietário e peça à Garden Justice Legal Initiative que revise qualquer acordo.',
      },
      fast_resales: {
        since: (n, year) => `Vendido ${n} vezes desde ${year}.`,
        inYear: (n, year) => `Vendido ${n} vezes em ${year}.`,
        between: (n, first, last) => `Vendido ${n} vezes de ${first} a ${last}.`,
        careful:
          'Revendas rápidas podem significar que o imóvel está sendo negociado para dar lucro, e às vezes com uma escritura falsificada. Também podem ser comuns, como uma família que vende uma casa herdada e o comprador a revende depois de reformas.',
        next: 'Veja quem vendeu e quem comprou no histórico abaixo. Proprietários e famílias podem se inscrever nos alertas gratuitos do Fraud Guard da Prefeitura para saber quando um documento tem o nome deles.',
      },
      open_violations: {
        one: (when, what) => `O L&I lista 1 infração aberta${what ? `, por ${what}` : ''}${when ? `, de ${when}` : ''}.`,
        many: (n) => `O L&I lista ${n} infrações abertas.`,
        mostRecent: (when, what) => (what ? `A mais recente, de ${when}, é por ${what}.` : `A mais recente é de ${when}.`),
        careful: 'Uma infração é um aviso ao proprietário, que pode não ter meios de resolvê-la, e a condição pode ter mudado desde a inspeção.',
        next: 'Informe problemas físicos, como descarte de lixo ou prédio aberto, ao Philly311. Se você conhece o proprietário, avise-o: ele pode não ter visto o aviso.',
      },
      unsafe: {
        text: (since) => (since ? `O L&I lista este prédio como inseguro, desde ${since}.` : 'O L&I lista este prédio como inseguro.'),
        careful: 'Fique longe e mantenha as crianças longe: o L&I considerou a estrutura insegura. Não entre nela nem tente fechá-la por conta própria.',
        next: 'Se ele estiver aberto para entrar, informe ao Philly311 para que a Prefeitura possa lacrá-lo.',
      },
      imminently_dangerous: {
        text: (since) =>
          since ? `O L&I lista este prédio como em perigo iminente, desde ${since}.` : 'O L&I lista este prédio como em perigo iminente.',
        careful: 'O L&I constatou que a estrutura pode ceder a qualquer momento. Fique longe dela e mantenha os outros longe.',
        next: 'Informe qualquer mudança, como queda de tijolos ou uma porta aberta, ao Philly311.',
      },
    },

    history: {
      transfersTitle: 'Vendas e transferências',
      transfersCaption: 'Cada venda e transferência registrada deste imóvel, da mais recente para a mais antiga',
      date: 'Data',
      document: 'Documento',
      documentAndPrice: 'Documento e preço',
      fromAndTo: 'De quem e para quem',
      price: 'Preço',
      from: 'De',
      to: 'Para',
      noDate: 'Sem data',
      noPrice: 'Nenhum registrado',
      share: (n) => `a parte deste imóvel em uma escritura de ${n} imóveis`,
      more: (n) => `e ${pl(n, '# outro', '# outros')}`,
      noTransfers: 'Nenhuma escritura registrada.',
      notInCopy: (parts) =>
        `Nossa cópia semanal não inclui ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0]} deste lote, então esta página não pode dizer se existem.`,
      partialParts: { transfers: 'registros de escrituras', assessments: 'avaliações', li: 'registros de infrações do L&I' },
      notInCopyOff: 'Os dados ao vivo da Prefeitura podem mostrá-los.',
      notInCopyFailed: 'A Prefeitura não respondeu. Tente de novo para vê-los.',
      recordsNote: 'Os registros de escrituras da Prefeitura estão completos a partir de 2000. Vendas mais antigas podem estar faltando.',
      datesNote:
        'Cada data é a data da escritura e cada preço é arredondado para o dólar, como a página de imóveis da Prefeitura os mostra; a Prefeitura registra uma escritura dias ou semanas depois. Quando uma escritura cobriu vários imóveis, o preço é a parte deste imóvel.',
      documents: {
        DEED: 'Escritura',
        'DEED SHERIFF': 'Escritura do xerife',
        "SHERIFF'S DEED": 'Escritura do xerife',
        'DEED MISCELLANEOUS': 'Escritura diversa',
        'MISCELLANEOUS DEED': 'Escritura diversa',
        'DEED MISCELLANEOUS TAXABLE': 'Escritura diversa, tributável',
        'MISCELLANEOUS DEED TAXABLE': 'Escritura diversa, tributável',
        'DEED LAND BANK': 'Escritura do Land Bank',
        'DEED OF CONDEMNATION': 'Escritura de desapropriação',
        'DEED - DECEASED': 'Escritura de um espólio',
        'DEED - ADVERSE POSSESSION': 'Escritura por usucapião',
        'DEED RTT - OTHER': 'Outra escritura',
        'CERTIFICATE OF STOCK TRANSFER': 'Certificado de transferência de ações',
      },
      assessmentsTitle: 'Avaliações da Prefeitura',
      assessmentsCaption: 'A avaliação do valor de mercado pela Prefeitura, por ano',
      year: 'Ano',
      marketValue: 'Valor de mercado avaliado',
      noValue: 'Não registrado',
      noAssessments: 'Nenhuma avaliação registrada.',
      assessmentNote: 'Uma avaliação é a estimativa da Prefeitura do valor de mercado para fins de imposto sobre imóveis. Não é um preço de venda.',
      chartLabel: (first, last, low, high) =>
        `Gráfico da avaliação da Prefeitura de ${first} a ${last}, entre ${low} e ${high}. Os mesmos números estão na tabela abaixo.`,
      open: 'Aberta',
      liSummaryOpen: (n) => pl(n, '# infração aberta', '# infrações abertas'),
      liSummaryLast: (date) => `Infração mais recente: ${date}.`,
      liUnsafe: 'O L&I lista este prédio como inseguro.',
      liUnsafeSince: (date) => `O L&I lista este prédio como inseguro, desde ${date}.`,
      liDangerous: 'O L&I lista este prédio como em perigo iminente.',
      liDangerousSince: (date) => `O L&I lista este prédio como em perigo iminente, desde ${date}.`,
      liSince2016: (n) => `${pl(n, '# infração registrada', '# infrações registradas')} desde 2016.`,
      liSealed: (date) => `Última limpeza e lacre pela Prefeitura em ${date}.`,
      liDemolished: (date) => `Última demolição concluída em ${date}.`,
      liNeither: 'Não listado como inseguro nem como em perigo iminente.',
      liNowTitle: 'O L&I hoje',
      earlyDeed: 'Antes de 2000: de registros que a Prefeitura diz que podem estar incompletos.',
      timeline: {
        storyTitle: 'A história deste lote',
        storySource: (source) => `Fonte: ${source}.`,
        noStory: 'Os registros que temos ainda não contam uma história sobre este lote.',
        title: 'Linha do tempo',
        caption: 'Tudo o que há registrado sobre este imóvel, do mais recente para o mais antigo, por ano',
        intro:
          'Vendas, registros do L&I, recursos e registros de vacância em uma só lista, do mais recente para o mais antigo. Desative um tipo para ocultá-lo.',
        appeal: (board, kind) => (kind ? `${board}: ${kind}` : board),
        appealHearing: (date) => `audiência ${date}`,
        show: 'Mostrar na linha do tempo',
        loading: 'Carregando a linha do tempo da cópia semanal.',
        failed: 'Não foi possível carregar a linha do tempo da cópia semanal.',
        unpublished: 'Esta cópia do mapa ainda não tem arquivos de linha do tempo.',
        liMissing: 'Nossa cópia semanal não inclui registros do L&I deste lote, então a linha do tempo não pode dizer se existem.',
        liMissingOff: 'Os dados ao vivo da Prefeitura podem mostrá-los.',
        none: 'Nenhum registro na linha do tempo.',
        allHidden: 'Todos os tipos de registro estão desativados.',
        moreYears: (n) => `Mostrar ${pl(n, '# ano anterior', '# anos anteriores')}`,
        fewerYears: 'Mostrar só os anos recentes',
        noDate: 'Sem data',
        future: 'A Prefeitura datou isto no futuro; o registro dela pode estar errado.',
        printTitle: 'Linha do tempo, os 10 registros mais recentes',
        recordColumn: 'Registro',
        whatColumn: 'O que aconteceu',
        printWaiting: 'A página do lote online tem a linha do tempo completa; ela não estava carregada quando esta página foi impressa.',
        printMore: (n) => `${pl(n, '# registro mais antigo', '# registros mais antigos')} na página do lote online.`,
        noPrice: 'nenhum preço registrado',
        to: (names) => `para ${names}`,
        times: (n) => `(${formatNumber(n)} vezes)`,
        permit: 'Alvará',
        permitFor: (type, work) => `${type} para ${work}`,
        violation: 'Infração',
        demolition: 'Demolição',
        byCity: 'pela Prefeitura',
        privatePermit: 'com alvará particular',
        demolitionWork: {
          city: 'Demolição pela Prefeitura',
          complete: 'Demolição completa',
          small: 'Demolição de um prédio de até 3 andares',
          large: 'Demolição de um prédio com mais de 3 andares ou 40 pés',
          tank: 'Remoção de tanque',
        },
        cleanSeal: 'Limpo e lacrado pela Prefeitura',
        cleanSealClip: 'Limpo e lacrado pelo Community Life Improvement Program da Prefeitura',
        kinds: {
          deed: 'Escritura',
          violation: 'Infração',
          permit: 'Alvará',
          demolition: 'Demolição',
          unsafe: 'Aviso de prédio inseguro',
          imminently_dangerous: 'Aviso de prédio em perigo iminente',
          clean_seal: 'Limpeza e lacre',
          appeal: 'Recurso',
          vacancy: 'Registro de vacância',
        },
        toggles: {
          deed: 'Vendas e transferências',
          violation: 'Infrações',
          permit: 'Alvarás',
          demolition: 'Demolições',
          clean_seal: 'Limpeza e lacre',
          notice: 'Avisos de prédio inseguro e em perigo iminente',
          appeal: 'Recursos',
          vacancy: 'Registros de vacância e de cuidado',
        },
        lists: {
          city_land: 'Na lista de terrenos vazios da Prefeitura',
          city_building: 'Na lista de prédios vazios da Prefeitura',
          june_2024_land: 'Na lista de terrenos vazios do L&I de junho de 2024, mantida pela Clean & Green Philly',
          june_2024_building: 'Na lista própria de prédios vazios da Clean & Green Philly de junho de 2024',
        },
        landcare: (program) =>
          program === 'community_landcare'
            ? 'Vizinhos começaram a cuidar deste lote com o PHS Community LandCare'
            : 'O PHS LandCare começou a cuidar deste lote',
        story: {
          cityDemolished: (year) => `Um prédio ficou aqui até ${year}, quando a Prefeitura o demoliu.`,
          privateDemolished: (year) => `Um prédio ficou aqui até ${year}, quando foi demolido com alvará particular.`,
          newConstruction: (year) => `O L&I emitiu um alvará de construção nova aqui em ${year}.`,
          dangerous: (date) => `O L&I lista o prédio como em perigo iminente desde ${date}.`,
          unsafe: (date) => `O L&I lista o prédio como inseguro desde ${date}.`,
          sealed: (year, n) =>
            n > 1
              ? `A Prefeitura enviou aqui pela última vez as suas equipes de limpeza e lacre em ${year}; já fez isso ${formatNumber(n)} vezes.`
              : `A Prefeitura enviou aqui as suas equipes de limpeza e lacre em ${year}.`,
          sheriff: (year) => `Foi vendido em um leilão do xerife em ${year}.`,
          cityList: (land, date, june) =>
            `A lista de ${land ? 'terrenos vazios' : 'prédios vazios'} da Prefeitura de ${date} inclui este imóvel${june ? ', como uma lista de junho de 2024 também incluía' : ''}.`,
          juneList: (land) =>
            land ? 'A lista de terrenos vazios do L&I de junho de 2024 incluía este imóvel.' : 'A lista de prédios vazios da Clean & Green Philly de junho de 2024 incluía este imóvel.',
          landcare: (year, program) =>
            program === 'community_landcare'
              ? `Vizinhos cuidam dele com o PHS Community LandCare desde ${year}.`
              : `O PHS LandCare cuida dele desde ${year}.`,
          sources: {
            demolitions: 'registros de demolição do L&I',
            permits: 'registros de alvarás do L&I',
            notices: 'registros de prédios inseguros e em perigo iminente do L&I',
            cleanSeal: 'registros de limpeza e lacre do L&I',
            deeds: 'registros de escrituras da Prefeitura',
            lists: (june) =>
              june
                ? 'lista de imóveis vazios da Prefeitura e lista de junho de 2024 do L&I mantida pela Clean & Green Philly'
                : 'lista de imóveis vazios da Prefeitura',
            june: (land) => (land ? 'lista de junho de 2024 do L&I, mantida pela Clean & Green Philly' : 'lista de junho de 2024 da Clean & Green Philly'),
            landcare: 'lista do PHS LandCare dos lotes de que cuida',
          },
        },
      },
    },

    nearby: {
      intro: 'O que há em volta deste lote, para que o cuidado vá aonde mais ajuda.',
      careNote: 'Estas contagens mostram onde o cuidado é mais necessário. Elas não dizem nada sobre as pessoas que moram aqui.',
      areaSnapshot: 'Na área em volta deste lote, de cerca de dois quarteirões de largura',
      within500: 'A até 500 pés deste lote',
      s12: (n) => `${pl(n, '# pessoa baleada', '# pessoas baleadas')} nos últimos 12 meses`,
      s36: (n) => `${pl(n, '# pessoa baleada', '# pessoas baleadas')} nos últimos 3 anos`,
      killed: (n) => `${pl(n, '# pessoa morreu', '# pessoas morreram')} em colisões de trânsito desde 2019`,
      landcare: (n) => `${pl(n, '# lote mantido', '# lotes mantidos')} pelo PHS LandCare`,
      gardens: (n) => `${pl(n, '# jardim comunitário', '# jardins comunitários')}`,
      hearings: (n) => `${pl(n, '# audiência ainda por vir', '# audiências ainda por vir')} sobre outros imóveis`,
      playgroundHeading: 'Parquinho mais próximo',
      playground: (name, meters) =>
        `${name}, a cerca de ${distanceWords(meters)} em linha reta${meters <= 400 ? ', a até 5 minutos a pé' : meters <= 800 ? ', a até 10 minutos a pé' : ''}.`,
      none: 'Ainda não há contagens por perto para este lugar.',
      showLayer: (label) => `Mostrar ${label} no mapa`,
    },

    sources: {
      intro: 'De onde vem cada parte desta página e quão atual ela é.',
      live: (time) => `ao vivo da Prefeitura às ${time}`,
      snapshot: (date) => `cópia semanal de ${date}`,
      snapshotNoDate: 'cópia semanal',
      newest: (date) => `registro mais recente ${date}`,
      taxSnapshot: 'cópia final da Clean & Green Philly, 9 de julho de 2025',
      by: (publisher) => `Publicado por: ${publisher}`,
      correction: 'Informar uma correção',
      correctionHelp: 'Abre um formulário no GitHub, já preenchido com este lote. Para enviá-lo é preciso uma conta gratuita do GitHub.',
      ownerNote:
        'Se você é proprietário deste imóvel e um registro da Prefeitura sobre ele está errado, o órgão da Prefeitura que mantém o registro pode corrigi-lo na fonte: o Gabinete de Avaliação de Propriedades (OPA) para nomes de proprietários, endereços de correspondência e avaliações, o Departamento de Registros para escrituras, e Licenças e Inspeções (L&I) para infrações e alvarás.',
    },

    ownerList: {
      title: 'Os lotes deste proprietário na nossa lista',
      intro: (names) => `Lotes da nossa lista cujo proprietário está registrado como ${names}.`,
      others: 'Outros lotes da nossa lista cujo proprietário está registrado com os mesmos nomes deste.',
      loading: 'Carregando a lista',
      missing: 'Esta lista não está disponível agora.',
      open: (address) => `Abrir a página do lote de ${address}`,
      kind: (kind, confidence) => (confidence ? `${kind}, ${confidence.toLowerCase()}` : kind),
    },

    print: {
      printed: (date) => `Impresso do Placekeepers em ${date}.`,
      recent: 'Histórico recente',
      moreOnline: (n) => `${pl(n, '# registro a mais', '# registros a mais')} na página do lote online.`,
      lastAssessment: (year, value) => `Avaliação da Prefeitura de ${year}: ${value}.`,
      moreSources: (n) => `${pl(n, '# fonte a mais', '# fontes a mais')} na página do lote online.`,
      taxCenter: (url) => `Saldo de hoje: Tax Center da Prefeitura, ${url}`,
      rules: 'Regras para este lote',
    },

    rules: {
      intro:
        'O que os registros da Prefeitura e do governo federal dizem que vale para este lote: designação histórica, zoneamento e seus zoneamentos sobrepostos, registros de brownfield e recursos aos conselhos da Prefeitura. Nada disso diz se algo pode ser construído aqui. Pergunte ao órgão citado antes de planejar qualquer coisa.',
      notOnList:
        'As regras são calculadas toda semana para os lotes da nossa lista, e este lote não está nela. O Atlas, o mapa da Prefeitura, mostra o zoneamento e os zoneamentos sobrepostos dele, e a Comissão Histórica pode dizer se ele é histórico.',
      hearingTitle: 'Uma audiência está chegando',
      hearingSet: (board, date, time) => `Uma audiência ${board} sobre este lote está marcada para ${date}${time ? `, às ${time}` : ''}.`,
      hearingBoard: {
        zoning: 'de zoneamento',
        li_review: 'do Conselho de Revisão do L&I',
        building: 'do Conselho de Padrões de Construção',
        other: 'de um conselho da Prefeitura',
      },
      seeAppeal: 'Ver o recurso',
      historicTitle: 'Designação histórica',
      inDistrict: (district, date) => `Este lote está no ${district}${date ? `, designado em ${date}` : ''}.`,
      districtName: (name) => (/district/i.test(name) ? name : `distrito histórico ${name}`),
      listed: (date) => `Este imóvel está listado individualmente no Registro de Lugares Históricos da Filadélfia, desde ${date}.`,
      listedNoDate: 'Este imóvel está listado individualmente no Registro de Lugares Históricos da Filadélfia.',
      listedInDistrict: (district) => `Este imóvel está no Registro de Lugares Históricos da Filadélfia como parte do ${district}.`,
      askFirst:
        'Mudanças aqui podem precisar da análise da Comissão Histórica; consulte-a primeiro. Para um mural ou um jardim, consulte a Comissão antes de começar.',
      contact: 'Comissão Histórica da Filadélfia: 215 686 7660, preservation@phila.gov.',
      confirm: 'A Prefeitura pede que todos confirmem com a Comissão o status histórico de um imóvel.',
      commissionSite: 'O site da Comissão Histórica',
      projectReview: 'Como a Comissão analisa obras em imóveis históricos',
      findHistoric: 'Encontrar um imóvel ou distrito histórico',
      notHistoric: 'Os registros da Comissão Histórica não listam este lote como histórico. Pergunte à Comissão para ter certeza.',
      zoningTitle: 'Zoneamento',
      base: (code, group) => `Zoneamento base: ${code}${group ? `, ${group}` : ''}.`,
      zoningGroups: {
        'RESIDENTIAL/MULTI-FAMILY/RESIDENTIAL MIXED-USE': 'um distrito residencial',
        'COMMERCIAL/COMMERCIAL MIXED-USE': 'um distrito comercial e de uso misto',
        'INDUSTRIAL/INDUSTRIAL MIXED-USE': 'um distrito industrial',
        'SPECIAL PURPOSE': 'um distrito de finalidade especial, como parques, instituições ou o aeroporto',
      },
      basePending: 'Um projeto de lei em análise na Câmara Municipal mudaria isso.',
      readBill: 'Ler o projeto de lei',
      overlaysIntro: (n) =>
        n === 1 ? 'Um zoneamento sobreposto acrescenta regras próprias aqui:' : `${formatNumber(n)} zoneamentos sobrepostos acrescentam regras próprias aqui:`,
      noOverlays: 'Nenhum zoneamento sobreposto cobre este lote.',
      overlayKinds: { 1: 'Distrito sobreposto', 2: 'Regra especial', 3: 'Limite de pavimentação' },
      readRule: (section) => (section ? `Ler a regra: seção ${section} do Código de Zoneamento` : 'Ler a regra no Código de Zoneamento'),
      sunset: (date) => `Previsto para acabar em ${date}.`,
      pending: (bill) => `Um projeto de lei em análise na Câmara Municipal${bill ? `, o Bill ${bill},` : ''} mudaria isso.`,
      zoningNote:
        'O zoneamento e os zoneamentos sobrepostos podem mudar o que é permitido em um lote. Os mapas da Prefeitura podem ficar atrás de projetos de lei novos, então consulte o escritório de zoneamento da Prefeitura antes de planejar.',
      zoningHelp: 'A ajuda da Prefeitura sobre zoneamento e planejamento',
      atlasZoning: 'Este endereço no Atlas, o mapa da Prefeitura',
      overlayMeaning: {
        '/CTR': 'Regras extras para o Center City: usos, placas, alturas de prédios, estacionamento e a frente da rua.',
        '/NCO': 'Regras que mantêm novos prédios e ampliações em harmonia com este bairro.',
        '/NCA': 'Regras para as lojas e os usos ao longo desta rua comercial.',
        '/TOC': 'Regras perto de uma estação de trem que favorecem casas e lojas perto do transporte.',
        '/NIS': 'Regras sobre onde um local supervisionado de consumo de drogas injetáveis pode abrir. Cobre a maior parte da cidade.',
        '/MIN': 'Regras sobre moradias acessíveis em novos conjuntos de moradia.',
        '/AHP': 'Regras que incentivam manter moradias acessíveis.',
        '/AHC': 'Limites de altura perto do aeroporto.',
        '/HHC': 'Limites de altura perto de um heliporto.',
        '/ENV': 'Regras que protegem elementos naturais como árvores, encostas íngremes e riachos.',
        '/WWO': 'Regras que protegem o Wissahickon Creek e seus riachos.',
        '/DRC': 'Regras para terrenos ao longo do Rio Delaware.',
        '/CDO': 'Regras para a orla do Central Delaware.',
        '/FNE': 'Regras extras para o Far Northeast.',
        '/NE': 'Regras extras para o Northeast.',
        '/UED': 'Regras sobre grandes painéis luminosos e placas.',
        council: 'Regras extras que a Câmara Municipal definiu para parte de um distrito da Câmara.',
        flood: 'Regras de proteção contra enchentes: limites para construir e aterrar onde as enchentes chegam.',
        steep: 'Limites para construir e nivelar o terreno em encostas íngremes.',
        coverage: 'Limita quanto de um lote pode ser coberto por prédios e pavimento, para proteger o Wissahickon Creek.',
        animal: 'Uma área onde o Código de Zoneamento permite que as pessoas criem alguns animais de fazenda, sob as suas regras.',
        signs: 'Regras sobre placas e outdoors.',
        childCare: 'Regras sobre creches familiares em casas.',
        parking: 'Regras sobre quanto estacionamento os prédios novos precisam ter.',
        loading: 'Regras sobre áreas de carga e descarga dos prédios.',
        dispensary: 'Regras sobre a que distância um dispensário de maconha medicinal pode ficar de outros lugares.',
        institutional: 'Regras para instituições ao longo da Germantown Avenue.',
        pump: 'Regras perto de uma estação de bombeamento de água.',
        floorArea: 'Regras sobre quanta área construída os prédios podem ter.',
        waterfront: 'Recuos de construção ao longo da orla.',
        overlay: 'Um zoneamento sobreposto acrescenta regras próprias por cima do zoneamento base aqui.',
        supplemental: 'Uma regra especial que o Código de Zoneamento acrescenta para esta área.',
      },
      brownfieldTitle: 'Registros de brownfield',
      brownfield:
        'Foi registrada uma avaliação ou limpeza federal de brownfield (terreno que pode ter contaminação) neste endereço ou perto dele. Teste o solo antes de plantar alimentos.',
      brownfieldSite: (name, feet) => `${name}, a cerca de ${formatNumber(feet)} pés deste lote`,
      onLot: 'neste lote',
      brownfieldMore: (n) => `e ${pl(n, '# registro a mais', '# registros a mais')} a até cerca de 330 pés`,
      brownfieldNote: 'Os registros da EPA mostram onde uma verba federal de brownfield pagou por trabalhos. Eles não dizem o que há no solo hoje.',
      soilTest: 'O teste de solo da Penn State Extension',
      gardenGuide: 'O guia da EPA sobre jardinagem em solo urbano',
      epaRecord: 'Este registro na EPA',
      appealsTitle: 'Recursos e audiências',
      appealsIntro: 'Recursos aos conselhos da Prefeitura sobre este imóvel, do mais recente para o mais antigo, como a Prefeitura os publica.',
      noAppeals: 'Nenhum recurso aos conselhos da Prefeitura consta nos registros deste imóvel.',
      appealsMissing: 'Nossa cópia semanal foi feita sem os registros de recursos da Prefeitura, então esta página não pode dizer se existem.',
      appealsMissingOff: 'Os dados ao vivo da Prefeitura podem mostrá-los.',
      boards: {
        zoning: 'Conselho de Ajuste de Zoneamento (Zoning Board of Adjustment)',
        li_review: 'Conselho de Revisão do L&I (L&I Review Board)',
        building: 'Conselho de Padrões de Construção (Board of Building Standards)',
        other: 'Outro conselho da Prefeitura',
      },
      comingUp: 'Em breve',
      filed: (date) => `Protocolado em ${date}`,
      hearingOn: (date, time, upcoming) => `${upcoming ? 'Audiência marcada para' : 'Audiência em'} ${date}${time ? `, às ${time}` : ''}`,
      decidedOn: (date) => `Decidido em ${date}`,
      status: (status) => `Status: ${status}`,
      decision: (decision) => `Decisão: ${decision}`,
      rco: (name) => `A Prefeitura notificou esta organização comunitária registrada: ${name}.`,
      filedBy: 'Protocolado por',
      ownerNamed: 'Proprietário indicado',
      namesNote: 'Os nomes estão como a Prefeitura os publica. Eles aparecem só na página deste lote, nunca no mapa nem em arquivos baixados.',
      grounds: 'Leia o recurso e os seus fundamentos na Prefeitura (histórico do imóvel no L&I)',
      takePart: {
        zoning: 'Como participar de uma audiência de zoneamento',
        li_review: 'O Conselho de Revisão do L&I',
        building: 'O Conselho de Padrões de Construção',
        other: 'O calendário de recursos da Prefeitura',
      },
      calendar: 'O calendário de audiências da Prefeitura',
      decisions: {
        'GRANTED/PROV': 'Concedido com condições',
        'DENIED/PROV': 'Negado com condições',
        'DISMI/ENFORC': 'Arquivado',
        'ADMIN/REVIEW': 'Enviado para revisão administrativa',
        'HELD/INFO': 'Retido para mais informações',
        NEWHEARNOT: 'Nova audiência não concedida',
        BOARDAKNOWL: 'Reconhecido pelo conselho',
        'LATE-APPRVD': 'Recurso tardio aprovado',
        'CITY AFFIRMED': 'A decisão da Prefeitura se mantém',
        AFFIRMED: 'A decisão da Prefeitura se mantém',
      },
      missing: {
        historic:
          'Nossa cópia semanal foi feita sem o registro histórico, então esta página não pode dizer se este lote é histórico. Pergunte à Comissão Histórica.',
        overlays:
          'Nossa cópia semanal foi feita sem os zoneamentos sobrepostos, então esta página não pode listá-los. O Atlas, o mapa da Prefeitura, os mostra.',
        brownfields:
          'Nossa cópia semanal foi feita sem os registros de brownfield da EPA, então esta página não pode dizer se há algum por perto.',
      },
      none: 'Nenhum destes registros menciona este lote.',
    },
  },

  // @@END@@
};

export default ptBR;
