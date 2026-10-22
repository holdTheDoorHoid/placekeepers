# Cómo encontramos terrenos vacíos

La Ciudad publicaba su propia lista de lotes y edificios vacíos, pero esa lista dejó de ser
confiable en junio de 2024, y esa es la razón por la que cerró el proyecto original Clean & Green
Philly. Placekeepers nunca se apoya en una sola lista. Combinamos la lista de la propia Ciudad con
varios otros registros públicos, para que una sola fuente rota no pueda derribar todo el mapa.

## Lo que verá en el mapa

Cada parcela que creemos que está vacía aparece como un **lote** (sin ningún edificio encima) o un
**edificio** (en pie, pero vacío), junto con qué tan seguros estamos: confianza **alta**, **media**
o **baja**. Cada una muestra sus razones con palabras sencillas, por ejemplo "la lista de la Ciudad
dice que probablemente es un terreno vacío, los registros de propiedades de la Ciudad lo clasifican
como terreno vacío, y no hay la huella de ningún edificio en la parcela". Las parcelas de confianza
alta y media se muestran de forma predeterminada; las de confianza baja están ocultas detrás de un
filtro, porque casi son como lanzar una moneda al aire. Los parques, jardines, estacionamientos, vías de tren, servicios
públicos y cementerios nunca aparecen como vacíos, diga lo que diga cualquier lista.

Al 4 de octubre de 2026:

| Tipo | Confianza alta | Confianza media | Confianza baja | No se muestran (parques, jardines y similares) |
|---|---|---|---|---|
| Lotes | 24,166 | 6,147 | 10,465 | 1,727 |
| Edificios | 6,553 | 2,876 | 8,503 | |

## Lo que encontramos

- **La lista de septiembre de 2026 de la Ciudad es una actualización de verdad, y casi siempre
  acierta con los lotes.** Cuando la lista de la Ciudad y al menos dos de nuestros propios
  registros independientes coinciden en que un lote está vacío, 24 de los 26 que comparamos con
  fotos aéreas estaban vacíos, y los otros 2 no estaban claros.
- **La lista de la Ciudad por sí sola no basta.** Cuando solo la lista de la Ciudad dice que un
  lote está vacío, y a lo sumo uno de nuestros otros registros coincide, solo 5 de los 13 que
  comparamos con fotos estaban vacíos. Los demás eran casas, estacionamientos o incluso un parque
  infantil.
- **Nuestros propios registros encuentran unos 4,200 lotes vacíos más que la lista de la Ciudad
  deja fuera.** La mayoría de los que revisamos estaban vacíos, aunque varios eran patios laterales
  cuidados.
- **La lista de la Ciudad tarda en captar los lotes vacíos nuevos que se crean al demoler un
  edificio.** Una demolición aparece en nuestros propios registros de inmediato; a la Ciudad le
  puede tomar más de un año agregar el lote resultante a su propia lista.
- **Los edificios son más difíciles de juzgar que los lotes.** Una foto desde arriba no puede
  decir si en un edificio en pie vive alguien. Con los edificios, solo podemos medir qué tan bien
  coinciden entre sí distintos registros de la Ciudad, que es una evidencia más débil que una foto.

## Cómo decidimos

- **Confianza alta:** la lista de la Ciudad coincide, y al menos dos de nuestros propios registros
  independientes también coinciden (por ejemplo, ninguna huella de edificio, una demolición sin
  nada construido desde entonces, o una infracción conocida por lote vacío), y nada lo contradice.
- **Confianza media:** hay una coincidencia fuerte, pero con una cosa que nos hace dudar, como un
  mapa de planificación de la Ciudad que muestra algún otro uso, o un permiso de construcción
  nueva. También damos confianza media a algunos lotes que la lista de la Ciudad no incluye en
  absoluto, cuando al menos dos de nuestros propios registros coinciden claramente en que están
  vacíos.
- **Confianza baja:** una sola prueba, o pruebas que se contradicen. Estos están detrás de un
  filtro porque casi son como lanzar una moneda al aire, y preferimos esconder una suposición antes que mostrarla como
  un hecho.

## Si la lista de la Ciudad vuelve a fallar

Guardaremos la última copia buena de la lista de la Ciudad por doce meses, claramente marcada con
su fecha. Después de eso, o antes si deja de actualizarse como debe, pasaremos a reglas que no
dependen de ella en absoluto. El mapa diría menos con plena confianza: la mayoría de los lotes que
hoy tienen confianza alta bajarían a media (con lo que quedarían en el mapa unos 29,000 lotes con
confianza media en total), mientras que unos 2,936 edificios se quedarían con confianza alta. El
mapa nunca se apagaría por completo. Simplemente diría menos con certeza, y lo diría con claridad.

## Qué tan seguros estamos

Comparamos una pequeña muestra de parcelas con las fotografías aéreas de la propia Ciudad de la
primavera de 2023, sin saber de antemano de qué lista venía cada parcela, para que la revisión
fuera justa. En los lotes que llamamos de confianza alta, de 24 a 26 de 26 revisados estaban
realmente vacíos. En los lotes de confianza media, unos 18 a 20 de 23 estaban realmente vacíos. En
los lotes de confianza baja, de verdad fue casi como lanzar una moneda al aire, que es justo por lo que siguen ocultos
de forma predeterminada.

No pudimos revisar los edificios de esta manera, porque una foto desde arriba no puede mostrar si
alguien vive adentro. Todavía hace falta que una persona pase por una lista corta de direcciones y
mire, y agregaremos esos resultados al mapa cuando eso ocurra.

Esta revisión fue pequeña (115 parcelas en total), la hizo una sola persona mirando recortes de
fotos, con fotos que ya tienen unos años. La tratamos como una comprobación de la realidad de
nuestras reglas, no como una prueba final, y seguiremos mejorándola.
