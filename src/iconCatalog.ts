// src/iconCatalog.ts
// O CATÁLOGO de ícones — o que está atrás do "+" na grade de projetos e skills.
//
// A grade curta (PROJECT_ICONS, SKILL_ICONS) continua sendo a primeira
// resposta: ela cabe inteira na tela, sem rolagem, e cobre o caso comum. O
// catálogo é pra quando nenhum daqueles é O ícone — e aí a pergunta deixa de
// ser "qual destes 28" e vira "onde procuro". Por isso ele é CATEGORIZADO e
// não uma parede de 150: uma categoria por vez cabe na mesma altura da grade
// curta, e escolher continua sendo olhar, não rolar.
//
// Sobre os nomes: `setIcon` do Obsidian não reclama de nome que não existe —
// ele simplesmente não desenha nada, e o azulejo fica um buraco vazio. Todos
// os nomes abaixo foram conferidos contra o conjunto que o Obsidian instalado
// realmente embarca (1883 ícones Lucide, lidos do obsidian.asar) antes de
// entrarem aqui, e o teste guarda a forma deles.

export interface IconCategory {
  id: string;
  /** O que aparece na aba. */
  label: string;
  icons: string[];
}

export const ICON_CATALOG: IconCategory[] = [
  {
    id: "work",
    label: "Work",
    icons: [
      "briefcase", "target", "clipboard-list", "presentation", "handshake",
      "building-2", "users", "calendar", "clock", "check-check", "trending-up",
      "dollar-sign", "receipt", "wallet", "scale", "stamp", "piggy-bank",
      "landmark", "trophy", "rocket",
    ],
  },
  {
    id: "study",
    label: "Study",
    icons: [
      "graduation-cap", "book", "book-open", "library", "notebook-pen",
      "highlighter", "microscope", "flask-conical", "atom", "brain",
      "languages", "calculator", "ruler", "glasses", "binoculars",
      "lightbulb", "telescope", "medal",
    ],
  },
  {
    id: "writing",
    label: "Writing",
    icons: [
      "pencil", "pen-line", "feather", "type", "quote", "file-text",
      "notebook", "bookmark", "scroll", "newspaper", "list", "align-left",
      "text-cursor-input", "signature", "message-circle", "link",
    ],
  },
  {
    id: "code",
    label: "Code",
    icons: [
      "terminal", "braces", "code", "git-branch", "database", "server", "bug",
      "cpu", "binary", "package", "cloud", "globe", "keyboard", "wifi",
      "lock", "regex", "zap", "battery",
    ],
  },
  {
    id: "creative",
    label: "Creative",
    icons: [
      "palette", "brush", "camera", "film", "music", "mic", "headphones",
      "image", "wand-2", "scissors", "shapes", "pen-tool", "sparkles",
      "drama", "guitar", "clapperboard", "paintbrush", "swatch-book",
      "video", "circle-dot",
    ],
  },
  {
    id: "home",
    label: "Home",
    icons: [
      "home", "bed", "sofa", "lamp", "utensils", "coffee", "shopping-cart",
      "shirt", "washing-machine", "hammer", "wrench", "plug", "key",
      "door-open", "trash-2", "recycle", "axe", "paint-roller", "pizza",
      "phone",
    ],
  },
  {
    id: "health",
    label: "Health",
    icons: [
      "heart", "heart-pulse", "stethoscope", "dumbbell", "activity", "pill",
      "apple", "salad", "bike", "footprints", "moon", "sun", "bath",
      "syringe", "carrot", "wheat",
    ],
  },
  {
    id: "nature",
    label: "Nature",
    icons: [
      "leaf", "sprout", "tree-pine", "trees", "flower", "droplet", "mountain",
      "waves", "snowflake", "bird", "fish", "paw-print", "sunrise", "wind",
      "flame", "earth", "rainbow", "shell", "snail", "cloud-rain",
      "dog", "cat", "tractor", "umbrella",
    ],
  },
  {
    id: "travel",
    label: "Travel",
    icons: [
      "plane", "car", "train-front", "ship", "sailboat", "map", "map-pin",
      "compass", "luggage", "tent", "ticket", "backpack", "hotel", "fuel",
      "anchor",
    ],
  },
  {
    id: "life",
    label: "Life",
    icons: [
      "user", "baby", "heart-handshake", "gift", "party-popper", "cake",
      "smile", "star", "flag", "shield", "folder", "archive", "bell",
      "hourglass", "dice-5", "puzzle",
    ],
  },
];

/** Quantos ícones o catálogo oferece ao todo — é o número que a aba mostra. */
export function iconCatalogSize(): number {
  return ICON_CATALOG.reduce((n, c) => n + c.icons.length, 0);
}

/** Em que categoria está um ícone (pra abrir o catálogo já na aba dele). */
export function iconCategoryOf(icon: string): string | null {
  return ICON_CATALOG.find((c) => c.icons.includes(icon))?.id ?? null;
}
