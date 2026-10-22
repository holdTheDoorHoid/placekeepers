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
    shown: (layer, lens) => `Mostrando agora "${layer}", colorido pela lente ${lens.toLowerCase()}.`,
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
    scoreLine: (lens, weights) => `As pontuações usam a lente ${lens} com estes pesos: ${weights}.`,
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
    parcelsFillLens: (lens) => `Cor de preenchimento: prioridade na lente ${lens.toLowerCase()}`,
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
    crashesHere: (n) => `${pl(n, '# colisão', '# colisões')} neste ponto`,
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

  // @@END@@
};

export default ptBR;
