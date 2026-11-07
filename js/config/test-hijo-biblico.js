// T8 — Test «¿Qué hijo bíblico sos?» (contenido definido en E1, 07/11/2026).
// Lo usa js/views/test-hijo.js (T8 E2).
// Cómo se cuenta: 13 preguntas de 5 opciones; cada opción suma 1 punto a 2 hijos
// (cada hijo aparece una vez por pregunta). Gana el de más puntos; empate: el
// que sumó en la pregunta más reciente.
// Resultado: nombre, cita, fortaleza, desafío y virtud a cultivar. El temperamento
// NO se muestra (decisión del usuario): solo se usó para armar los perfiles.
// Decidido por el usuario: va en Recursos → Camino formativo, el resultado se
// guarda en el perfil y lo ven todos (Perfil y Mi comando), se puede repetir,
// y NO suma puntos para el rango.

// Temperamentos clásicos y la virtud que más necesita cada uno (fuente:
// madurezpsicologica.com/test-de-temperamento, 07/11/2026). Solo de referencia.
export const TEMPERAMENTOS = {
  sanguineo:   { rasgos: 'Entusiasta, sociable, comunicativo; tiende a la inestabilidad y a buscar lo nuevo.', virtud: 'resistencia' },
  colerico:    { rasgos: 'Decidido, emprendedor, líder; inclinado al orgullo y a la ira.', virtud: 'humildad' },
  melancolico: { rasgos: 'Contemplativo, perfeccionista; teme la acción y el riesgo, tiende a criticar.', virtud: 'audacia' },
  flematico:   { rasgos: 'Tranquilo, sabe escuchar, constante; evita los conflictos y teme equivocarse.', virtud: 'magnanimidad' },
};

export const VIRTUDES = {
  resistencia:  'Resistencia: la fortaleza para mantenerte en lo que empezaste.',
  humildad:     'Humildad: reconocer tus errores y servir a los demás.',
  audacia:      'Audacia: animarte a actuar y a arriesgar, aunque no tengas todo claro.',
  magnanimidad: 'Magnanimidad: tener un corazón grande y aspirar a cosas grandes.',
};

export const HIJOS_BIBLICOS = {
  A: { nombre: 'El hijo pródigo', cita: 'Lc 15, 11-24', temperamento: ['sanguineo'], virtud: 'resistencia',
       fortaleza: 'Te gusta probar, salir y arriesgar. Sabés reconocer cuando te equivocás y volver: el Padre te espera con la fiesta preparada.',
       desafio: 'La constancia: no dejarte llevar por lo que te entusiasma en el momento ni gastar lo que tenés en cosas que no llenan.' },
  B: { nombre: 'El hijo mayor', cita: 'Lc 15, 25-32', temperamento: ['flematico', 'melancolico'], virtud: 'magnanimidad',
       fortaleza: 'Sos constante y responsable, el que siempre está. «Hijo, tú estás siempre conmigo».',
       desafio: 'Hacer las cosas por amor y no por obligación, no compararte, y tener el corazón grande para entrar a la fiesta del hermano que vuelve.' },
  C: { nombre: 'Isaac', cita: 'Gn 22, 1-14', temperamento: ['flematico'], virtud: 'magnanimidad',
       fortaleza: 'Confiás aunque no entiendas todo y dejás que el Padre te guíe, como Isaac subiendo el monte.',
       desafio: 'Tomar la iniciativa y animarte a cosas grandes, sin esperar siempre a que otro decida por vos.' },
  D: { nombre: 'José, hijo de Jacob', cita: 'Gn 37-45', temperamento: ['colerico', 'melancolico'], virtud: 'humildad',
       fortaleza: 'Tenés sueños grandes, organizás y aguantás cuando las cosas salen mal. Sabés perdonar y convertir el mal en bien.',
       desafio: 'José contaba sus sueños de más y sus hermanos se enojaron: que tus planes no te pongan por encima de los demás.' },
  E: { nombre: 'Samuel', cita: '1 Sam 3, 1-10', temperamento: ['flematico', 'melancolico'], virtud: 'audacia',
       fortaleza: 'Sos de escuchar y servir. Estás atento a lo que Dios te pide: «Habla, Señor, que tu siervo escucha».',
       desafio: 'Animarte a hablar cuando hace falta, aunque cueste: Samuel tuvo que decirle a Elí una verdad difícil.' },
  F: { nombre: 'Juan, el discípulo amado', cita: 'Jn 19, 25-27', temperamento: ['sanguineo'], virtud: 'resistencia',
       fortaleza: 'Vivís la fe desde la amistad con Jesús. Sos cercano y cariñoso, y recibiste a María como Madre.',
       desafio: 'Ser constante también cuando cuesta: en Getsemaní se durmió y en el arresto huyó con los demás (Mc 14, 37.50), pero volvió y se quedó al pie de la cruz.' },
  G: { nombre: 'David', cita: '1 Sam 17, 32-50', temperamento: ['colerico', 'sanguineo'], virtud: 'humildad',
       fortaleza: 'Das la cara aunque el gigante sea grande. Confiás en Dios más que en tus fuerzas y le cantás con alegría.',
       desafio: 'Dominar tus pasiones y reconocer tus errores: David cayó feo, pero cuando lo corrigieron se arrepintió de verdad (Sal 51).' },
  H: { nombre: 'Salomón', cita: '1 Re 3, 5-12', temperamento: ['melancolico', 'sanguineo'], virtud: 'resistencia',
       fortaleza: 'Pensás antes de actuar y te gusta entender. Pediste lo más importante: un corazón que sepa escuchar y distinguir el bien del mal.',
       desafio: 'Que la sabiduría no se quede en la cabeza y ser fiel hasta el final: Salomón, de grande, se dejó llevar y se desvió de Dios (1 Re 11, 4).' },
  I: { nombre: 'Jacob', cita: 'Gn 32, 23-31', temperamento: ['colerico'], virtud: 'humildad',
       fortaleza: 'Sos luchador y no te rendís nunca. Peleaste hasta recibir la bendición: «No te soltaré hasta que me bendigas».',
       desafio: 'No tomar atajos ni hacer trampa para conseguir lo que querés (Jacob engañó a su hermano y a su padre), y dejarte vencer por Dios.' },
  J: { nombre: 'Timoteo, hijo querido de Pablo', cita: '2 Tim 1, 2-7', temperamento: ['melancolico', 'flematico'], virtud: 'audacia',
       fortaleza: 'Sos fiel, constante y aprendés de los que te guían. No hacés ruido, pero siempre estás.',
       desafio: 'Vencer la timidez y reavivar el don que tenés: «Dios no nos dio un espíritu de cobardía, sino de fortaleza».' },
};

// Cada opción: [[hijo, hijo], texto]. Las primeras 9 preguntas usan los 45 pares
// posibles una vez cada uno (método de torneo «todos contra todos»); las 4 de
// después repiten pares, ninguno más de 2 veces en todo el test.
export const PREGUNTAS_HIJO_BIBLICO = [
  { p: 'Un sábado libre en el campamento, vos…', o: [
    [['B', 'J'], 'Termino lo que tenía pendiente.'],
    [['A', 'C'], 'Me sumo a lo que propongan los demás.'],
    [['D', 'I'], 'Armo un plan o una competencia para todos.'],
    [['E', 'H'], 'Me quedo tranquilo: rezo o leo un rato.'],
    [['F', 'G'], 'Lo paso con mi mejor amigo.'] ] },
  { p: '¿Cuál te describe mejor?', o: [
    [['C', 'J'], 'Prefiero que otro decida; yo acompaño.'],
    [['B', 'D'], 'Si hay que hacerse cargo, me hago cargo.'],
    [['A', 'E'], 'Me animo a dejar lo conocido.'],
    [['F', 'I'], 'Por los que quiero hago lo que sea.'],
    [['G', 'H'], 'Me gusta crear: música, dibujos, poesía.'] ] },
  { p: 'Si te toca un desafío difícil en el campamento…', o: [
    [['A', 'G'], 'Me tiro de cabeza, aunque parezca imposible.'],
    [['D', 'J'], 'Aguanto, aunque tarde en salir.'],
    [['C', 'E'], 'Primero pregunto qué se espera de mí, y confío.'],
    [['B', 'F'], 'Me quedo hasta el final, aunque los demás se vayan.'],
    [['H', 'I'], 'Busco la forma más inteligente de resolverlo.'] ] },
  { p: 'Cuando te mandás una macana…', o: [
    [['A', 'I'], 'Al principio busco zafar, pero termino haciéndome cargo.'],
    [['E', 'J'], 'Me da vergüenza; lo hablo con alguien que me guía.'],
    [['D', 'F'], 'Pido perdón y busco que la relación quede bien.'],
    [['C', 'G'], 'Le pido perdón a Dios y confío en que me perdona.'],
    [['B', 'H'], 'Pienso bien qué salió mal para no repetirlo.'] ] },
  { p: 'Tu forma de rezar favorita…', o: [
    [['F', 'J'], 'Rezando con otros, con mis amigos.'],
    [['E', 'G'], 'Cantando o sirviendo en la Misa.'],
    [['D', 'H'], 'Pidiéndole a Dios que me ilumine en lo que tengo que decidir.'],
    [['C', 'I'], 'Al aire libre, mirando la naturaleza.'],
    [['A', 'B'], 'Diciéndole al Padre lo que siento, aunque sea un reproche o un «perdón».'] ] },
  { p: '¿Qué te cuesta más?', o: [
    [['H', 'J'], 'Pasar de la teoría a la práctica.'],
    [['G', 'I'], 'Controlar mi carácter cuando me desafían.'],
    [['A', 'F'], 'Ser constante cuando se acaba el entusiasmo.'],
    [['B', 'E'], 'Que no valoren lo que hago.'],
    [['C', 'D'], 'Aguantar cuando me tratan injustamente.'] ] },
  { p: 'Una frase que te representa:', o: [
    [['I', 'J'], '«Pelear el buen combate y terminar la carrera».'],
    [['A', 'H'], '«Probé de todo, y nada me llenó como Dios».'],
    [['B', 'G'], '«El Señor es mi pastor, nada me falta».'],
    [['C', 'F'], '«Descanso confiado en tus manos».'],
    [['D', 'E'], '«Dios me habla, y yo trato de entender».'] ] },
  { p: 'Si te toca aprender algo nuevo…', o: [
    [['E', 'H'], 'Leo y pregunto hasta entenderlo bien.'],
    [['A', 'G'], 'Lo pruebo enseguida: aprendo haciendo.'],
    [['F', 'J'], 'Le pido a alguien de confianza que me enseñe.'],
    [['B', 'I'], 'Practico hasta que me salga perfecto.'],
    [['C', 'D'], 'Escucho al que sabe y lo aplico con paciencia.'] ] },
  { p: '¿Qué valorás más de un jefe?', o: [
    [['A', 'J'], 'Que me tenga paciencia y me reciba aunque me equivoque.'],
    [['B', 'I'], 'Que reconozca mi esfuerzo.'],
    [['C', 'H'], 'Que me explique bien las cosas y me dé buenos consejos.'],
    [['D', 'G'], 'Que confíe en mí y me dé responsabilidades grandes.'],
    [['E', 'F'], 'Que me escuche y sea cercano.'] ] },
  { p: 'En un fogón, vos…', o: [
    [['A', 'F'], 'Hago reír y charlo con todos.'],
    [['E', 'G'], 'Canto todas las canciones.'],
    [['D', 'I'], 'Organizo los juegos.'],
    [['B', 'J'], 'Me ocupo de la leña y de que no se apague el fuego.'],
    [['C', 'H'], 'Escucho tranquilo y miro el fuego.'] ] },
  { p: 'Si alguien de tu sección está mal…', o: [
    [['E', 'F'], 'Me siento al lado y lo escucho.'],
    [['G', 'I'], 'Lo defiendo si alguien lo está molestando.'],
    [['A', 'D'], 'Le cuento que yo también pasé por algo así y salí.'],
    [['B', 'H'], 'Le doy un consejo práctico para que lo resuelva.'],
    [['C', 'J'], 'Rezo por él y le aviso a un jefe.'] ] },
  { p: 'Si el Padre te diera hoy tu parte de la herencia (Lc 15, 12)…', o: [
    [['A', 'I'], 'Me iría a conocer el mundo.'],
    [['B', 'D'], 'La cuidaría y la haría crecer, trabajando.'],
    [['C', 'F'], 'No la pediría: prefiero quedarme con el Padre.'],
    [['E', 'J'], 'Se la ofrecería a Dios para servirlo.'],
    [['G', 'H'], 'Construiría algo grande para Dios.'] ] },
  { p: '¿Qué te gustaría que te diga el Padre?', o: [
    [['G', 'J'], '«Que nadie te desprecie por ser joven».'],
    [['F', 'H'], '«Sos mi amado».'],
    [['E', 'I'], '«Estoy con vos y te cuido a donde vayas».'],
    [['A', 'D'], '«Te levanté cuando tocaste fondo».'],
    [['B', 'C'], '«Todo lo mío es tuyo».'] ] },
];
