// src/ui/modelCatalog.ts
// Organiza a lista crua que o provider devolve em algo digerível: PAPEL (o que
// o modelo faz) e, dentro dele, FAMÍLIA (a linhagem).
//
// Nada disso é inventado aqui — o motor já sabe as três coisas:
//   getModelCard().category  → categoria semântica do modelo
//   categoryToRole()         → colapsa em chat / reasoning / image / …
//   getModelFamily()         → Opus, GPT-5, o-series, Llama… (com ícone e cor)
// Este arquivo só junta, conta e ordena, pra UI não precisar saber de nada.
//
// O papel vira o segmented control (um filtro); a família vira as seções
// dentro da lista filtrada.

import { getModelCard } from "../providers/modelDescriptions";
import { getModelFamily, getFamilyRank } from "../providers/modelFamily";
import {
  categoryToRole,
  ROLE_ICONS,
  ROLE_LABELS,
  ROLE_ORDER,
  type RoleId,
} from "../providers/modelRoles";
import { compararFabricantes, fabricante, type Fabricante } from "../providers/vendors";
import { tr } from "../i18n/tr";

export interface CatalogFamily {
  id: string;
  label: string;
  icon: string;
  color: string;
  models: string[];
}

export interface CatalogRole {
  id: RoleId;
  label: string;
  icon: string;
  /** Total de modelos do papel (soma das famílias). */
  count: number;
  families: CatalogFamily[];
}

/**
 * Agrupa os modelos por papel → família. Só devolve papéis que TÊM modelo —
 * um filtro vazio é ruído, e a régua é a mesma do segmented: cabe na tela.
 * Famílias saem na ordem canônica da tabela (linhagem mais nova primeiro) e os
 * modelos dentro de cada uma em ordem alfabética.
 */
export function buildModelCatalog(
  provider: string,
  models: string[]
): CatalogRole[] {
  const byRole = new Map<RoleId, Map<string, CatalogFamily>>();

  for (const model of models) {
    const role = categoryToRole(getModelCard(provider, model).category);
    const fam = getModelFamily(model);
    const families = byRole.get(role) ?? new Map<string, CatalogFamily>();
    const entry = families.get(fam.id) ?? {
      id: fam.id,
      label: tr(fam.label),
      icon: fam.icon,
      color: fam.color,
      models: [],
    };
    entry.models.push(model);
    families.set(fam.id, entry);
    byRole.set(role, families);
  }

  const out: CatalogRole[] = [];
  for (const role of ROLE_ORDER) {
    const families = byRole.get(role);
    if (!families) continue;
    const list = Array.from(families.values()).sort(
      (a, b) => getFamilyRank(a.id) - getFamilyRank(b.id)
    );
    for (const f of list) f.models.sort();
    out.push({
      id: role,
      // O nome do papel já sai no idioma da interface: o catálogo é montado
      // na hora de desenhar a lista.
      label: tr(ROLE_LABELS[role]),
      icon: ROLE_ICONS[role],
      count: list.reduce((n, f) => n + f.models.length, 0),
      families: list,
    });
  }
  return out;
}

// ── um nível a mais: o FABRICANTE ─────────────────────────────────────────
// Nos providers que revendem os modelos de todo mundo (OpenRouter, NIM), a
// lista vira fabricante → classe → modelo. Nos de uma casa só, esse nível
// repetiria o nome do provider em cima de tudo — lá a classe basta.

/** Uma seção (papel × família) dentro de um fabricante. */
export interface SecaoDoFabricante {
  roleId: RoleId;
  roleLabel: string;
  roleIcon: string;
  family: CatalogFamily;
}

export interface GrupoDoFabricante {
  fabricante: Fabricante;
  total: number;
  secoes: SecaoDoFabricante[];
}

/** Reagrupa as seções do catálogo por fabricante, mantendo a ordem das seções
 *  (papel, depois família) dentro de cada um. */
export function porFabricante(groups: CatalogRole[]): GrupoDoFabricante[] {
  const mapa = new Map<string, GrupoDoFabricante>();
  for (const g of groups) {
    for (const fam of g.families) {
      for (const m of fam.models) {
        const f = fabricante(m);
        const grupo = mapa.get(f.chave) ?? { fabricante: f, total: 0, secoes: [] };
        let sec = grupo.secoes.find((s) => s.roleId === g.id && s.family.id === fam.id);
        if (!sec) {
          sec = { roleId: g.id, roleLabel: g.label, roleIcon: g.icon, family: { ...fam, models: [] } };
          grupo.secoes.push(sec);
        }
        sec.family.models.push(m);
        grupo.total++;
        mapa.set(f.chave, grupo);
      }
    }
  }
  return Array.from(mapa.values()).sort((a, b) => compararFabricantes(a.fabricante, b.fabricante));
}

/** Uma lista solta (o filtro Free) agrupada por fabricante. */
export function soltosPorFabricante(
  models: string[]
): Array<{ fabricante: Fabricante; models: string[] }> {
  const mapa = new Map<string, { fabricante: Fabricante; models: string[] }>();
  for (const m of models) {
    const f = fabricante(m);
    const grupo = mapa.get(f.chave) ?? { fabricante: f, models: [] };
    grupo.models.push(m);
    mapa.set(f.chave, grupo);
  }
  const lista = Array.from(mapa.values());
  for (const g of lista) g.models.sort();
  return lista.sort((a, b) => compararFabricantes(a.fabricante, b.fabricante));
}
