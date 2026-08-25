// Dataset curado de emoji para el picker del compositor (RF-13, CA-14, CA-15).
//
// Sin `import` de red ni de librerías externas — dato puro embebido.
// La búsqueda es una función pura y síncrona sobre un índice precalculado en
// tiempo de carga del módulo (no recalculado por tecla, mitigación de R14 /
// RNF-06: el picker debe abrir en <100ms).

export interface EmojiCategory {
  readonly id: string;
  readonly label: string;
}

export interface EmojiEntry {
  readonly char: string;
  readonly keywords: readonly string[];
  readonly category: string;
}

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  { id: 'caras', label: 'Caras y emociones' },
  { id: 'gestos', label: 'Gestos y manos' },
  { id: 'afecto', label: 'Corazones y afecto' },
  { id: 'oficina', label: 'Oficina y negocios' },
  { id: 'simbolos', label: 'Símbolos y objetos' },
] as const;

// ─── Caras y emociones (mínimo 55) ─────────────────────────────────────────
const CARAS: EmojiEntry[] = [
  { char: '😀', keywords: ['feliz', 'sonrisa', 'contento'], category: 'caras' },
  { char: '😃', keywords: ['feliz', 'sonrisa', 'alegre', 'ojos abiertos'], category: 'caras' },
  { char: '😄', keywords: ['feliz', 'sonrisa', 'risa', 'alegre'], category: 'caras' },
  { char: '😁', keywords: ['sonrisa', 'dientes', 'feliz'], category: 'caras' },
  { char: '😆', keywords: ['risa', 'carcajada', 'feliz'], category: 'caras' },
  { char: '😅', keywords: ['risa', 'nervioso', 'alivio', 'sudor'], category: 'caras' },
  { char: '🤣', keywords: ['carcajada', 'risa', 'rodando'], category: 'caras' },
  { char: '😂', keywords: ['risa', 'llorar de risa', 'lagrimas'], category: 'caras' },
  { char: '🙂', keywords: ['sonrisa leve', 'tranquilo'], category: 'caras' },
  { char: '🙃', keywords: ['al reves', 'sarcasmo', 'irónico'], category: 'caras' },
  { char: '😉', keywords: ['guino', 'complicidad'], category: 'caras' },
  { char: '😊', keywords: ['sonrisa', 'timido', 'contento'], category: 'caras' },
  { char: '😇', keywords: ['angel', 'inocente', 'santo'], category: 'caras' },
  { char: '😍', keywords: ['enamorado', 'ojos de corazon', 'amor'], category: 'caras' },
  { char: '🥰', keywords: ['enamorado', 'cariño', 'corazones'], category: 'caras' },
  { char: '😘', keywords: ['beso', 'cariño'], category: 'caras' },
  { char: '😗', keywords: ['beso', 'silbido'], category: 'caras' },
  { char: '😙', keywords: ['beso', 'sonrisa'], category: 'caras' },
  { char: '😚', keywords: ['beso', 'ojos cerrados'], category: 'caras' },
  { char: '😋', keywords: ['rico', 'sabroso', 'saboreando'], category: 'caras' },
  { char: '😛', keywords: ['lengua', 'juguetón'], category: 'caras' },
  { char: '😝', keywords: ['lengua', 'guiño', 'travieso'], category: 'caras' },
  { char: '😜', keywords: ['lengua', 'guiño', 'broma'], category: 'caras' },
  { char: '🤪', keywords: ['loco', 'alocado', 'gracioso'], category: 'caras' },
  { char: '🤨', keywords: ['duda', 'sospecha', 'ceja levantada'], category: 'caras' },
  { char: '🧐', keywords: ['curioso', 'monoculo', 'analizando'], category: 'caras' },
  { char: '🤓', keywords: ['nerd', 'estudioso', 'anteojos'], category: 'caras' },
  { char: '😎', keywords: ['genial', 'lentes de sol', 'copado'], category: 'caras' },
  { char: '🥸', keywords: ['disfraz', 'bigote', 'anteojos'], category: 'caras' },
  { char: '🤩', keywords: ['fascinado', 'estrellas', 'impresionado'], category: 'caras' },
  { char: '🥳', keywords: ['fiesta', 'celebración', 'cumpleaños'], category: 'caras' },
  { char: '😏', keywords: ['picaro', 'sonrisa de lado', 'sarcasmo'], category: 'caras' },
  { char: '😒', keywords: ['fastidio', 'aburrido', 'meh'], category: 'caras' },
  { char: '😞', keywords: ['decepcionado', 'triste'], category: 'caras' },
  { char: '😔', keywords: ['triste', 'pensativo', 'apenado'], category: 'caras' },
  { char: '😟', keywords: ['preocupado', 'inquieto'], category: 'caras' },
  { char: '😕', keywords: ['confundido', 'incomodo'], category: 'caras' },
  { char: '🙁', keywords: ['triste', 'desilusionado'], category: 'caras' },
  { char: '☹️', keywords: ['triste', 'frunce'], category: 'caras' },
  { char: '😣', keywords: ['perseverancia', 'esfuerzo', 'apretado'], category: 'caras' },
  { char: '😖', keywords: ['confundido', 'agobiado'], category: 'caras' },
  { char: '😫', keywords: ['cansado', 'agotado', 'agobiado'], category: 'caras' },
  { char: '😩', keywords: ['cansado', 'exhausto', 'quejido'], category: 'caras' },
  { char: '🥺', keywords: ['suplica', 'ojitos', 'tierno'], category: 'caras' },
  { char: '😢', keywords: ['triste', 'lagrima', 'llorando'], category: 'caras' },
  { char: '😭', keywords: ['llorando', 'triste', 'mucho llanto'], category: 'caras' },
  { char: '😤', keywords: ['enojo', 'frustracion', 'resoplido'], category: 'caras' },
  { char: '😠', keywords: ['enojado', 'molesto'], category: 'caras' },
  { char: '😡', keywords: ['furioso', 'enojado', 'rojo de ira'], category: 'caras' },
  { char: '🤬', keywords: ['furioso', 'insultos', 'groseria'], category: 'caras' },
  { char: '🤯', keywords: ['mente explotada', 'sorprendido', 'shock'], category: 'caras' },
  { char: '😳', keywords: ['sonrojado', 'vergüenza', 'sorpresa'], category: 'caras' },
  { char: '🥵', keywords: ['calor', 'transpirando'], category: 'caras' },
  { char: '🥶', keywords: ['frio', 'congelado'], category: 'caras' },
  { char: '😱', keywords: ['miedo', 'susto', 'grito'], category: 'caras' },
  { char: '😨', keywords: ['miedo', 'asustado'], category: 'caras' },
  { char: '😰', keywords: ['ansiedad', 'nervioso', 'sudor frio'], category: 'caras' },
  { char: '😥', keywords: ['triste', 'aliviado', 'preocupado'], category: 'caras' },
  { char: '😓', keywords: ['sudor', 'esfuerzo', 'cansado'], category: 'caras' },
  { char: '🤗', keywords: ['abrazo', 'cariño'], category: 'caras' },
  { char: '🤔', keywords: ['pensando', 'duda', 'reflexion'], category: 'caras' },
  { char: '🤭', keywords: ['risa contenida', 'sorpresa', 'mano en boca'], category: 'caras' },
  { char: '🤫', keywords: ['silencio', 'shh', 'secreto'], category: 'caras' },
  { char: '🤥', keywords: ['mentiroso', 'pinocho'], category: 'caras' },
  { char: '😶', keywords: ['sin palabras', 'silencio'], category: 'caras' },
  { char: '😐', keywords: ['neutral', 'indiferente'], category: 'caras' },
  { char: '😑', keywords: ['inexpresivo', 'aburrido'], category: 'caras' },
  { char: '😬', keywords: ['incomodo', 'mueca', 'nervios'], category: 'caras' },
  { char: '🙄', keywords: ['ojos en blanco', 'hartazgo'], category: 'caras' },
  { char: '😯', keywords: ['sorpresa', 'asombro'], category: 'caras' },
  { char: '😦', keywords: ['sorpresa', 'boca abierta'], category: 'caras' },
  { char: '😧', keywords: ['angustia', 'sorpresa'], category: 'caras' },
  { char: '😮', keywords: ['sorpresa', 'asombro', 'oh'], category: 'caras' },
  { char: '😲', keywords: ['asombrado', 'shock'], category: 'caras' },
  { char: '🥱', keywords: ['bostezo', 'sueño', 'aburrido'], category: 'caras' },
  { char: '😴', keywords: ['dormido', 'sueño', 'zzz'], category: 'caras' },
  { char: '🤤', keywords: ['babeando', 'antojo'], category: 'caras' },
  { char: '😪', keywords: ['sueño', 'cansado'], category: 'caras' },
  { char: '😵', keywords: ['mareado', 'aturdido'], category: 'caras' },
  { char: '🤐', keywords: ['boca cerrada', 'cierre', 'silencio'], category: 'caras' },
  { char: '🥴', keywords: ['mareado', 'confundido'], category: 'caras' },
  { char: '🤢', keywords: ['nauseas', 'asco'], category: 'caras' },
  { char: '🤮', keywords: ['vomito', 'asco'], category: 'caras' },
  { char: '🤧', keywords: ['estornudo', 'resfrio'], category: 'caras' },
  { char: '😷', keywords: ['barbijo', 'enfermo', 'tapabocas'], category: 'caras' },
  { char: '🤒', keywords: ['fiebre', 'enfermo', 'termometro'], category: 'caras' },
  { char: '🤕', keywords: ['herido', 'vendaje', 'dolor de cabeza'], category: 'caras' },
];

// ─── Gestos y manos (mínimo 30) ─────────────────────────────────────────────
const GESTOS: EmojiEntry[] = [
  { char: '👋', keywords: ['saludo', 'hola', 'chau'], category: 'gestos' },
  { char: '🤚', keywords: ['mano levantada', 'alto'], category: 'gestos' },
  { char: '🖐️', keywords: ['mano abierta', 'cinco dedos'], category: 'gestos' },
  { char: '✋', keywords: ['parar', 'alto', 'mano'], category: 'gestos' },
  { char: '🖖', keywords: ['saludo vulcano', 'star trek'], category: 'gestos' },
  { char: '👌', keywords: ['ok', 'perfecto', 'de acuerdo'], category: 'gestos' },
  { char: '🤌', keywords: ['que decis', 'gesto italiano'], category: 'gestos' },
  { char: '🤏', keywords: ['pizca', 'poquito'], category: 'gestos' },
  { char: '✌️', keywords: ['paz', 'victoria', 'dos dedos'], category: 'gestos' },
  { char: '🤞', keywords: ['dedos cruzados', 'suerte'], category: 'gestos' },
  { char: '🫰', keywords: ['corazon con dedos', 'finger heart'], category: 'gestos' },
  { char: '🤟', keywords: ['te amo', 'rock'], category: 'gestos' },
  { char: '🤘', keywords: ['rock', 'cuernos'], category: 'gestos' },
  { char: '🤙', keywords: ['llamame', 'shaka'], category: 'gestos' },
  { char: '👈', keywords: ['izquierda', 'apuntar'], category: 'gestos' },
  { char: '👉', keywords: ['derecha', 'apuntar'], category: 'gestos' },
  { char: '👆', keywords: ['arriba', 'apuntar'], category: 'gestos' },
  { char: '🖕', keywords: ['grosero', 'ofensivo'], category: 'gestos' },
  { char: '👇', keywords: ['abajo', 'apuntar'], category: 'gestos' },
  { char: '☝️', keywords: ['indice arriba', 'atencion'], category: 'gestos' },
  { char: '👍', keywords: ['pulgar arriba', 'bien', 'ok'], category: 'gestos' },
  { char: '👎', keywords: ['pulgar abajo', 'mal', 'no'], category: 'gestos' },
  { char: '✊', keywords: ['puño', 'poder', 'resistencia'], category: 'gestos' },
  { char: '👊', keywords: ['puño', 'choque'], category: 'gestos' },
  { char: '🤛', keywords: ['puño izquierdo', 'choque'], category: 'gestos' },
  { char: '🤜', keywords: ['puño derecho', 'choque'], category: 'gestos' },
  { char: '👏', keywords: ['aplauso', 'felicitaciones'], category: 'gestos' },
  { char: '🙌', keywords: ['manos arriba', 'celebracion'], category: 'gestos' },
  { char: '👐', keywords: ['manos abiertas', 'abrazo'], category: 'gestos' },
  { char: '🤲', keywords: ['manos juntas', 'ofrecer'], category: 'gestos' },
  { char: '🤝', keywords: ['apreton de manos', 'trato', 'acuerdo'], category: 'gestos' },
  { char: '🙏', keywords: ['gracias', 'por favor', 'rezo'], category: 'gestos' },
  { char: '✍️', keywords: ['escribir', 'firmar'], category: 'gestos' },
  { char: '💅', keywords: ['uñas', 'manicura', 'despreocupado'], category: 'gestos' },
  { char: '🤳', keywords: ['selfie', 'foto'], category: 'gestos' },
  { char: '💪', keywords: ['fuerza', 'musculo', 'poder'], category: 'gestos' },
];

// ─── Corazones y afecto (mínimo 20) ─────────────────────────────────────────
const AFECTO: EmojiEntry[] = [
  { char: '❤️', keywords: ['corazon', 'amor', 'rojo'], category: 'afecto' },
  { char: '🧡', keywords: ['corazon naranja', 'cariño'], category: 'afecto' },
  { char: '💛', keywords: ['corazon amarillo', 'amistad'], category: 'afecto' },
  { char: '💚', keywords: ['corazon verde', 'cariño'], category: 'afecto' },
  { char: '💙', keywords: ['corazon azul', 'confianza'], category: 'afecto' },
  { char: '💜', keywords: ['corazon violeta', 'cariño'], category: 'afecto' },
  { char: '🖤', keywords: ['corazon negro'], category: 'afecto' },
  { char: '🤍', keywords: ['corazon blanco', 'pureza'], category: 'afecto' },
  { char: '🤎', keywords: ['corazon marron'], category: 'afecto' },
  { char: '💔', keywords: ['corazon roto', 'ruptura'], category: 'afecto' },
  { char: '💕', keywords: ['dos corazones', 'cariño'], category: 'afecto' },
  { char: '💞', keywords: ['corazones girando', 'amor'], category: 'afecto' },
  { char: '💓', keywords: ['corazon latiendo', 'emocion'], category: 'afecto' },
  { char: '💗', keywords: ['corazon creciendo', 'cariño'], category: 'afecto' },
  { char: '💖', keywords: ['corazon brillante', 'amor'], category: 'afecto' },
  { char: '💘', keywords: ['corazon flecha', 'enamorado', 'cupido'], category: 'afecto' },
  { char: '💝', keywords: ['corazon regalo', 'san valentin'], category: 'afecto' },
  { char: '💟', keywords: ['adorno corazon', 'amor'], category: 'afecto' },
  { char: '♥️', keywords: ['corazon', 'naipe', 'amor'], category: 'afecto' },
  { char: '💑', keywords: ['pareja', 'enamorados'], category: 'afecto' },
  { char: '💏', keywords: ['beso', 'pareja'], category: 'afecto' },
  { char: '🌹', keywords: ['rosa', 'flor', 'romance'], category: 'afecto' },
];

// ─── Oficina y negocios (mínimo 30) ─────────────────────────────────────────
const OFICINA: EmojiEntry[] = [
  { char: '💼', keywords: ['maletin', 'trabajo', 'negocio'], category: 'oficina' },
  { char: '📁', keywords: ['carpeta', 'archivo'], category: 'oficina' },
  { char: '📂', keywords: ['carpeta abierta', 'archivo'], category: 'oficina' },
  { char: '🗂️', keywords: ['fichero', 'organizacion'], category: 'oficina' },
  { char: '📅', keywords: ['calendario', 'fecha', 'agenda'], category: 'oficina' },
  { char: '📆', keywords: ['calendario', 'planificacion'], category: 'oficina' },
  { char: '🗒️', keywords: ['notas', 'bloc'], category: 'oficina' },
  { char: '🗓️', keywords: ['calendario', 'agenda'], category: 'oficina' },
  { char: '📇', keywords: ['tarjetero', 'contactos'], category: 'oficina' },
  { char: '📈', keywords: ['grafico ascendente', 'crecimiento', 'ventas'], category: 'oficina' },
  { char: '📉', keywords: ['grafico descendente', 'caida'], category: 'oficina' },
  { char: '📊', keywords: ['grafico de barras', 'estadisticas'], category: 'oficina' },
  { char: '📋', keywords: ['portapapeles', 'lista de tareas'], category: 'oficina' },
  { char: '📌', keywords: ['chinche', 'importante', 'fijar'], category: 'oficina' },
  { char: '📍', keywords: ['ubicacion', 'marcador'], category: 'oficina' },
  { char: '📎', keywords: ['clip', 'sujetapapeles', 'adjunto'], category: 'oficina' },
  { char: '🖇️', keywords: ['clips', 'sujetapapeles'], category: 'oficina' },
  { char: '📏', keywords: ['regla', 'medir'], category: 'oficina' },
  { char: '📐', keywords: ['escuadra', 'medir', 'angulo'], category: 'oficina' },
  { char: '✂️', keywords: ['tijeras', 'cortar'], category: 'oficina' },
  { char: '🗃️', keywords: ['fichero', 'archivo'], category: 'oficina' },
  { char: '🗄️', keywords: ['archivador', 'gabinete'], category: 'oficina' },
  { char: '🔒', keywords: ['candado cerrado', 'seguridad'], category: 'oficina' },
  { char: '🔓', keywords: ['candado abierto', 'desbloqueado'], category: 'oficina' },
  { char: '🔑', keywords: ['llave', 'acceso', 'contraseña'], category: 'oficina' },
  { char: '🔧', keywords: ['llave inglesa', 'herramienta', 'reparar'], category: 'oficina' },
  { char: '⚙️', keywords: ['engranaje', 'configuracion', 'ajustes'], category: 'oficina' },
  { char: '🧰', keywords: ['caja de herramientas'], category: 'oficina' },
  { char: '💻', keywords: ['computadora', 'laptop', 'notebook'], category: 'oficina' },
  { char: '🖥️', keywords: ['computadora de escritorio', 'monitor'], category: 'oficina' },
  { char: '🖨️', keywords: ['impresora'], category: 'oficina' },
  { char: '⌨️', keywords: ['teclado'], category: 'oficina' },
  { char: '🖱️', keywords: ['mouse', 'raton'], category: 'oficina' },
  { char: '💾', keywords: ['guardar', 'disquete'], category: 'oficina' },
  { char: '📞', keywords: ['telefono', 'llamada'], category: 'oficina' },
  { char: '☎️', keywords: ['telefono', 'llamada'], category: 'oficina' },
  { char: '📧', keywords: ['email', 'correo electronico'], category: 'oficina' },
  { char: '✉️', keywords: ['sobre', 'carta', 'correo'], category: 'oficina' },
  { char: '📩', keywords: ['mensaje recibido', 'correo'], category: 'oficina' },
  { char: '📨', keywords: ['correo entrante', 'mensaje'], category: 'oficina' },
  { char: '📤', keywords: ['bandeja de salida', 'enviar'], category: 'oficina' },
  { char: '📥', keywords: ['bandeja de entrada', 'recibir'], category: 'oficina' },
  { char: '📦', keywords: ['paquete', 'envio'], category: 'oficina' },
  { char: '✏️', keywords: ['lapiz', 'escribir', 'editar'], category: 'oficina' },
  { char: '✒️', keywords: ['lapicera', 'firmar'], category: 'oficina' },
  { char: '🖋️', keywords: ['pluma', 'firmar'], category: 'oficina' },
  { char: '📝', keywords: ['nota', 'memo', 'anotacion'], category: 'oficina' },
];

// ─── Símbolos y objetos (mínimo 25) ─────────────────────────────────────────
const SIMBOLOS: EmojiEntry[] = [
  { char: '✅', keywords: ['listo', 'correcto', 'aprobado', 'check'], category: 'simbolos' },
  { char: '❌', keywords: ['error', 'incorrecto', 'cancelar'], category: 'simbolos' },
  { char: '❎', keywords: ['no', 'rechazado'], category: 'simbolos' },
  { char: '➕', keywords: ['mas', 'sumar', 'agregar'], category: 'simbolos' },
  { char: '➖', keywords: ['menos', 'restar', 'quitar'], category: 'simbolos' },
  { char: '➗', keywords: ['dividir', 'division'], category: 'simbolos' },
  { char: '✖️', keywords: ['multiplicar', 'por', 'cruz'], category: 'simbolos' },
  { char: '♾️', keywords: ['infinito'], category: 'simbolos' },
  { char: '‼️', keywords: ['doble exclamacion', 'urgente'], category: 'simbolos' },
  { char: '⁉️', keywords: ['interrogacion exclamacion', 'sorpresa'], category: 'simbolos' },
  { char: '❓', keywords: ['pregunta', 'duda'], category: 'simbolos' },
  { char: '❗', keywords: ['exclamacion', 'atencion', 'importante'], category: 'simbolos' },
  { char: '💯', keywords: ['cien', 'perfecto', 'excelente'], category: 'simbolos' },
  { char: '🔔', keywords: ['campana', 'notificacion', 'alerta'], category: 'simbolos' },
  { char: '🔕', keywords: ['sin sonido', 'silenciado'], category: 'simbolos' },
  { char: '🎉', keywords: ['fiesta', 'celebracion', 'confeti'], category: 'simbolos' },
  { char: '🎊', keywords: ['confeti', 'celebracion'], category: 'simbolos' },
  { char: '🎈', keywords: ['globo', 'cumpleaños', 'fiesta'], category: 'simbolos' },
  { char: '🎁', keywords: ['regalo', 'sorpresa'], category: 'simbolos' },
  { char: '🏆', keywords: ['trofeo', 'ganador', 'premio'], category: 'simbolos' },
  { char: '🥇', keywords: ['medalla de oro', 'primer lugar'], category: 'simbolos' },
  { char: '⭐', keywords: ['estrella', 'destacado'], category: 'simbolos' },
  { char: '🌟', keywords: ['estrella brillante', 'destacado'], category: 'simbolos' },
  { char: '✨', keywords: ['brillo', 'destello', 'magia'], category: 'simbolos' },
  { char: '⚡', keywords: ['rayo', 'energia', 'rapido'], category: 'simbolos' },
  { char: '🔥', keywords: ['fuego', 'genial', 'tendencia'], category: 'simbolos' },
  { char: '🌈', keywords: ['arcoiris', 'diversidad'], category: 'simbolos' },
  { char: '☀️', keywords: ['sol', 'soleado'], category: 'simbolos' },
  { char: '⏰', keywords: ['despertador', 'hora', 'recordatorio'], category: 'simbolos' },
  { char: '⏳', keywords: ['tiempo', 'espera', 'reloj de arena'], category: 'simbolos' },
];

export const EMOJI_ENTRIES: readonly EmojiEntry[] = [
  ...CARAS,
  ...GESTOS,
  ...AFECTO,
  ...OFICINA,
  ...SIMBOLOS,
];

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeSearchText(value: string): string {
  return stripDiacritics(value).toLowerCase();
}

// Índice precalculado UNA vez en tiempo de carga del módulo, no por tecla
// (mitigación de R14 / RNF-06: el picker debe abrir/filtrar en <100ms).
const SEARCH_INDEX: readonly string[] = EMOJI_ENTRIES.map((entry) =>
  normalizeSearchText(entry.keywords.join(' ')),
);

/** Búsqueda pura y síncrona sobre el índice precalculado. */
export function searchEmojis(query: string): readonly EmojiEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return EMOJI_ENTRIES;
  const needle = normalizeSearchText(trimmed);
  const results: EmojiEntry[] = [];
  for (let i = 0; i < EMOJI_ENTRIES.length; i++) {
    if (SEARCH_INDEX[i].includes(needle)) results.push(EMOJI_ENTRIES[i]);
  }
  return results;
}

export function emojisByCategory(categoryId: string): readonly EmojiEntry[] {
  return EMOJI_ENTRIES.filter((entry) => entry.category === categoryId);
}
