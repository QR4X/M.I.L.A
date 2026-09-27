// src/ui/SheetForm.tsx
// As peças de FORMULÁRIO da folha: rótulo, campo, texto longo, grade de
// ícones, cores e o botão que conclui.
//
// A folha já sabia oferecer escolhas (Sheet.tsx: linhas, abas, segmentos) —
// tudo coisa de quem ESCOLHE entre o que já existe. Criar um skill ou um
// projeto é outro verbo: é escrever o que ainda não existe. Estas peças são
// esse verbo, e moram aqui em vez de dentro do Sheet porque o Sheet é a
// casca: ele sobe, arrasta e fecha; o que vai dentro é assunto de quem usa.
//
// Uma regra atravessa todas: o rótulo fica ACIMA do campo, nunca dentro dele.
// Rótulo que vive de placeholder some na hora em que a pessoa começa a
// digitar — justamente quando ela ainda precisa dele.

import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useSheetFull, useSheetLevel } from "./Sheet";
import { ICON_CATALOG, iconCategoryOf } from "../iconCatalog";

/** Rótulo + explicação + o campo. A unidade do formulário. */
export function SheetField({
  label,
  hint,
  children,
}: {
  label: string;
  /** Uma linha dizendo o que aquilo faz. Só onde o nome não basta. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="axxa-field">
      <span className="axxa-field-label">{label}</span>
      {hint && <span className="axxa-field-hint">{hint}</span>}
      {children}
    </label>
  );
}

export function SheetInput({
  value,
  placeholder,
  autoFocus,
  onChange,
}: {
  value: string;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className="axxa-input"
      type="text"
      value={value}
      placeholder={placeholder}
      // A folha do formulário abre com `focusOnOpen={false}` pra este campo
      // poder pegar o foco — o efeito do pai roda depois do do filho, e sem
      // isso o painel rouba o cursor (a mesma armadilha da busca).
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

export function SheetTextarea({
  value,
  placeholder,
  rows = 6,
  onChange,
}: {
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      className="axxa-textarea"
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

/**
 * Escolha única em pílulas — os modos, as opções curtas.
 *
 * É lista, não segmented: o segmented divide a largura em partes iguais e
 * promete que todas as opções cabem na linha. Aqui elas quebram pra segunda
 * linha sem drama.
 */
export function SheetChoices({
  items,
  value,
  onPick,
  label,
}: {
  items: Array<{
    id: string;
    label: string;
    icon?: string;
    /**
     * Quantos itens há lá dentro. Vai em expoente, miúdo: é uma nota de
     * rodapé do nome, não um segundo dado disputando com ele — e diz antes do
     * toque se vale a pena entrar. Só onde a opção ABRE uma lista; opção que
     * é só uma escolha (os modos) não tem o que contar.
     */
    count?: number;
  }>;
  value: string;
  onPick: (id: string) => void;
  label: string;
}) {
  return (
    <div className="axxa-choices" role="group" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={it.id === value ? "axxa-choice is-on" : "axxa-choice"}
          aria-pressed={it.id === value}
          /* O nome inteiro vai no rótulo acessível: lido em voz alta, "Work 21"
             não diz o que é o 21 — "Work, 21 icons" diz. */
          aria-label={
            it.count === undefined ? undefined : `${it.label}, ${it.count} icons`
          }
          onClick={() => onPick(it.id)}
        >
          {it.icon && <Icon name={it.icon} size={16} />}
          <span>{it.label}</span>
          {it.count !== undefined && (
            <sup className="axxa-choice-count" aria-hidden="true">
              {it.count}
            </sup>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Um azulejo da grade.
 *
 * Mora aqui fora porque a grade curta e o catálogo desenham o MESMO botão —
 * e um azulejo marcado que se pintasse de um jeito num lugar e de outro no
 * outro faria a pessoa duvidar se escolheu a mesma coisa.
 */
function IconTile({
  icon,
  on,
  tint,
  onPick,
}: {
  icon: string;
  on: boolean;
  tint?: string;
  onPick: (icon: string) => void;
}) {
  return (
    <button
      type="button"
      className={
        "axxa-icontile" + (on ? " is-on" : "") + (on && tint ? " is-tinted" : "")
      }
      aria-label={icon}
      aria-pressed={on}
      /* `color`, e não um fundo direto: o fundo do azulejo sai daqui por
         `currentColor`, igual ao brasão. Uma fonte só pra cor. */
      style={on && tint ? { color: tint } : undefined}
      onClick={() => onPick(icon)}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

/**
 * A grade de ícones — a curta, com um "+" no fim que abre o catálogo.
 *
 * A grade curta cabe INTEIRA na folha, sem rolagem interna: grade que rola
 * dentro de folha que também rola é um lugar onde o dedo nunca sabe o que vai
 * acontecer. Ela é a primeira resposta e resolve o caso comum.
 *
 * O "+" é a porta pro resto. Quem abre não está mais preenchendo um
 * formulário: está PROCURANDO — e é o formulário que sai da frente (ver
 * `SheetIconCatalog` e quem o usa).
 */
export function SheetIconGrid({
  icons,
  value,
  onPick,
  onBrowse,
  /**
   * A cor escolhida logo acima. Quando existe, o azulejo marcado vira a
   * MESMA plaquinha do brasão do projeto — cor cheia no ícone, fundo tirado
   * dela (ver `.axxa-icontile.is-on.is-tinted`). Sem ela — o caso das skills,
   * que não têm cor — o marcado continua no accent do app.
   */
  tint,
}: {
  icons: readonly string[];
  value: string;
  onPick: (icon: string) => void;
  /** Tocou no "+". Quem manda é o formulário: é ele que troca de tela. */
  onBrowse: () => void;
  tint?: string;
}) {
  // Um ícone escolhido no catálogo não está na grade curta. Sem isto ele
  // sumia da vista ao voltar — a grade voltava sem NENHUM marcado, e a única
  // pista do que foi escolhido era o cartão de prévia lá em cima. Ele entra na
  // frente, que é onde o olho volta.
  const curtos = icons.includes(value) ? [...icons] : [value, ...icons];

  return (
    <div className="axxa-icongrid" role="group" aria-label="Icon">
      {curtos.map((ic) => (
        <IconTile
          key={ic}
          icon={ic}
          on={ic === value}
          tint={tint}
          onPick={onPick}
        />
      ))}
      {/* O "+" fecha a fileira, no lugar onde um item a mais entraria — e não
          no começo, que é do primeiro ícone de verdade. Ele não é um ícone
          escolhível: é a porta pros outros. */}
      <button
        type="button"
        className="axxa-icontile is-more"
        aria-label="More icons"
        title="More icons"
        onClick={onBrowse}
      >
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}

/**
 * O CATÁLOGO: a tela de procurar ícone.
 *
 * Ela substitui o formulário inteiro enquanto está aberta — nome, prompt,
 * descrição, tudo sai. Não é economia de espaço: é que procurar ícone é outra
 * tarefa, e um campo de texto no meio dela só serve pra ser esbarrado. Fica o
 * voltar, a cor (quando há uma: é ela que decide como o ícone vai parecer) e
 * os ícones.
 *
 * As categorias são PÍLULAS que quebram de linha, não uma fileira que anda pro
 * lado. Fileira que rola esconde o que não coube, e o que não coube some sem
 * avisar: numa tela de 375px, "Travel" e "Life" ficavam fora da borda e só
 * existiam pra quem pensasse em arrastar. Em pílulas, as dez categorias estão
 * todas na tela antes do primeiro toque.
 */
export function SheetIconCatalog({
  value,
  onPick,
  onBack,
  tint,
  children,
}: {
  value: string;
  onPick: (icon: string) => void;
  onBack: () => void;
  tint?: string;
  /**
   * O que sobrevive do formulário, entre o voltar e as categorias — hoje só
   * o seletor de cor dos projetos. Fica ACIMA dos ícones, e não abaixo:
   * embaixo de uma grade de vinte, mudar a cor pediria rolar de volta pra ver
   * o que mudou.
   */
  children?: ReactNode;
}) {
  // A folha vai pro tamanho grande ao entrar aqui, e não cresce por conta
  // própria depois: esta tela não tem campo pra focar nem nada que a faça
  // crescer sozinha, e na altura do conteúdo apareceriam duas fileiras de
  // ícones — procurar viraria rolar às cegas.
  useSheetFull();
  // E EMPRESTA o título e o voltar à barra de cima enquanto está aberto. Sem
  // isto a barra continuava dizendo "New skill" com a tela cheia de ícones, e
  // a seta dela pulava o formulário inteiro: voltar desfazia dois toques em
  // vez de um.
  useSheetLevel("Icon", onBack);

  /** Começa na categoria do ícone de agora — quem veio trocar um avião
   *  provavelmente quer outro de viagem, não a primeira pílula. */
  const [aba, setAba] = useState(
    () => iconCategoryOf(value) ?? ICON_CATALOG[0].id
  );
  const atual = ICON_CATALOG.find((c) => c.id === aba) ?? ICON_CATALOG[0];

  return (
    <div className="axxa-iconcat">
      {/* Sem botão de voltar aqui dentro: quem volta é a seta da barra de
          cima, que esta tela agora empresta (useSheetLevel). Enquanto ela
          pulava o formulário inteiro, um voltar próprio era a única saída
          certa; agora as duas fariam a mesma coisa a 50px uma da outra. */}
      {children}
      <SheetChoices
        label="Icon category"
        value={atual.id}
        onPick={setAba}
        items={ICON_CATALOG.map((c) => ({
          id: c.id,
          label: c.label,
          icon: c.icon,
          count: c.icons.length,
        }))}
      />
      <div className="axxa-icongrid" role="group" aria-label={atual.label}>
        {atual.icons.map((ic) => (
          <IconTile
            key={ic}
            icon={ic}
            on={ic === value}
            tint={tint}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * As cores, em azulejos da forma da casa — os mesmos 44px dos ícones logo
 * abaixo. Eram bolinhas de 30px: forma que o app não usa em lugar nenhum e
 * alvo menor que o mínimo de toque, então escolher uma cor era mira.
 *
 * A marcada ganha um ANEL, não um check: o check taparia justamente a cor que
 * se está escolhendo. E o anel é feito do jeito que a forma exige — pai
 * mascarado com padding e a cor do anel no fundo, filho mascarado por cima
 * (docs/SQUIRCLE.md, "O padrão de anel"): `box-shadow` não serve, a máscara
 * apaga tudo que é desenhado fora da caixa.
 */
export function SheetSwatches({
  colors,
  value,
  onPick,
  resolve,
}: {
  colors: readonly string[];
  value: string;
  onPick: (color: string) => void;
  /** Traduz o id da cor pra um valor CSS ("default" → cor do tema). */
  resolve: (color: string) => string;
}) {
  return (
    <div className="axxa-swatches" role="group" aria-label="Color">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={c === value ? "axxa-swatch is-on" : "axxa-swatch"}
          aria-label={c}
          aria-pressed={c === value}
          onClick={() => onPick(c)}
        >
          <span
            className="axxa-swatch-fill"
            style={{ backgroundColor: resolve(c) }}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * O botão que conclui, grudado no fim do conteúdo da folha.
 *
 * Ele NUNCA fica desligado por falta de preenchimento: botão apagado não diz
 * o que falta, e quem chegou até o fim da folha merece uma frase em vez de um
 * botão morto. O que falta vira `problema` — a folha explica e não grava.
 */
export function SheetSubmit({
  label,
  icon = "check",
  problema,
  onSubmit,
}: {
  label: string;
  icon?: string;
  /** O que impede de salvar agora; null = pronto. */
  problema?: string | null;
  onSubmit: () => void;
}) {
  return (
    <div className="axxa-form-foot">
      {problema && (
        <p className="axxa-form-problem" role="status">
          <Icon name="info" size={15} />
          <span>{problema}</span>
        </p>
      )}
      <button
        type="button"
        className="axxa-form-submit"
        aria-disabled={!!problema}
        onClick={onSubmit}
      >
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </button>
    </div>
  );
}
