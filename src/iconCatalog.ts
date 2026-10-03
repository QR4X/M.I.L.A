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

import { marca } from "./i18n/tr";

export interface IconCategory {
  id: string;
  /** O que aparece na pílula. */
  label: string;
  /**
   * O emblema da categoria, na pílula, antes do nome.
   *
   * Não é enfeite: as pílulas são dez e o nome delas é uma palavra só, então
   * de relance a fileira vira um bloco de texto uniforme. O desenho é o que
   * se acha sem ler — e é o mesmo alfabeto da grade logo abaixo, que é toda
   * feita de desenho.
   */
  icon: string;
  icons: string[];
}

export const ICON_CATALOG: IconCategory[] = [
  {
    id: "work",
    icon: "briefcase",
    label: marca("Work"),
    icons: [
      "briefcase", "target", "clipboard-list", "presentation", "handshake",
      "building-2", "users", "calendar", "clock", "check-check", "trending-up",
      "dollar-sign", "receipt", "wallet", "scale", "stamp", "piggy-bank",
      "landmark", "trophy", "rocket", "archive",
    ],
  },
  {
    id: "study",
    icon: "graduation-cap",
    label: marca("Study"),
    icons: [
      "graduation-cap", "book", "book-open", "library", "notebook-pen",
      "highlighter", "microscope", "flask-conical", "atom", "brain",
      "languages", "calculator", "ruler", "glasses", "binoculars",
      "lightbulb", "telescope", "medal",
    ],
  },
  {
    id: "writing",
    icon: "pencil",
    label: marca("Writing"),
    icons: [
      "pencil", "pen-line", "feather", "type", "quote", "file-text",
      "notebook", "bookmark", "scroll", "newspaper", "list", "align-left",
      "text-cursor-input", "signature", "message-circle", "link",
    ],
  },
  {
    id: "code",
    icon: "terminal",
    label: marca("Code"),
    icons: [
      "terminal", "braces", "code", "git-branch", "database", "server", "bug",
      "cpu", "binary", "package", "cloud", "globe", "keyboard", "wifi",
      "lock", "regex", "battery",
    ],
  },
  {
    id: "creative",
    icon: "palette",
    label: marca("Creative"),
    icons: [
      "palette", "brush", "camera", "film", "music", "mic", "headphones",
      "image", "wand-2", "scissors", "shapes", "pen-tool", "sparkles",
      "drama", "guitar", "clapperboard", "paintbrush", "swatch-book",
      "video",
    ],
  },
  {
    id: "home",
    icon: "home",
    label: marca("Home"),
    icons: [
      "home", "bed", "sofa", "lamp", "shopping-cart", "shirt",
      "washing-machine", "hammer", "wrench", "plug", "key", "door-open",
      "trash-2", "recycle", "axe", "paint-roller", "phone",
    ],
  },
  {
    id: "health",
    icon: "heart-pulse",
    label: marca("Health"),
    icons: [
      "heart", "heart-pulse", "stethoscope", "dumbbell", "activity", "pill",
      "bike", "footprints", "moon", "sun", "bath", "syringe",
    ],
  },
  {
    id: "nature",
    icon: "leaf",
    label: marca("Nature"),
    icons: [
      "leaf", "sprout", "tree-pine", "trees", "flower", "droplet", "mountain",
      "waves", "snowflake", "bird", "fish", "paw-print", "sunrise", "wind",
      "flame", "earth", "rainbow", "shell", "snail", "cloud-rain",
      "dog", "cat", "tractor", "umbrella",
    ],
  },
  {
    id: "travel",
    icon: "plane",
    label: marca("Travel"),
    icons: [
      "plane", "car", "train-front", "ship", "sailboat", "map", "map-pin",
      "compass", "luggage", "tent", "ticket", "backpack", "hotel", "fuel",
      "anchor",
    ],
  },
  {
    id: "life",
    icon: "user",
    label: marca("Life"),
    icons: [
      "user", "baby", "heart-handshake", "hand-heart", "gift",
      "party-popper", "smile", "flag", "shield", "bell", "hourglass",
      "dice-5", "puzzle",
    ],
  },
  {
    id: "food",
    icon: "utensils",
    label: marca("Food"),
    icons: [
      "utensils", "utensils-crossed", "chef-hat", "cooking-pot", "soup",
      "pizza", "sandwich", "egg", "salad", "apple", "carrot", "wheat",
      "cake", "cookie", "croissant", "ice-cream-cone", "coffee", "cup-soda",
      "wine", "beer", "milk",
    ],
  },
  {
    id: "symbols",
    icon: "star",
    label: marca("Symbols"),
    icons: [
      "star", "crown", "gem", "award", "badge-check", "check", "x", "info",
      "alert-triangle", "asterisk", "hash", "at-sign", "percent", "infinity",
      "zap", "circle-dot", "sticker",
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
