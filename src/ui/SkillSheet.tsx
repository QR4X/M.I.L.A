// src/ui/SkillSheet.tsx
// O FORMULÁRIO de um skill — o conteúdo, não a folha.
//
// Ele já foi uma folha própria. Deixou de ser quando Skills virou uma folha
// inteira (0.6.57): folha dentro de folha não funciona no nosso desenho (a de
// dentro é posicionada pelo painel da de fora e some junto com a rolagem
// dele), e mesmo que funcionasse seriam duas cascas empilhadas pro mesmo
// assunto. Agora ele é um NÍVEL da folha de Skills, como "escolher nota" é um
// nível da folha de projetos.
//
// O botão de concluir NÃO está aqui: ele é da folha (prop `footer`),
// fora da área que rola — sticky no fim do conteúdo pousava no meio do
// formulário quando o teclado encolhia a área visível.
//
// A ordem das perguntas é a ordem da cabeça de quem cria: primeiro COMO SE
// CHAMA e O QUE ELE ESCREVE — que é o skill inteiro —, e só depois os
// enfeites. Quem parar de responder no meio já tem um skill que funciona.

import { CHAT_MODES } from "../core/session";
import { SKILL_ICONS, type SkillDraft } from "../skills/skillFile";
import { PROJECT_COLORS, projectColor } from "../projects";
import { Icon } from "./Icon";
import { MODULES } from "./modules";
import {
  SheetChoices,
  SheetField,
  SheetIconCatalog,
  SheetIconGrid,
  SheetInput,
  SheetSwatches,
  SheetTextarea,
} from "./SheetForm";
import { useState } from "react";
import type AxxaPlugin from "../main";
import { AssistantPanel, ComAssistente } from "./AssistantPanel";
import { useAssistant } from "./useAssistant";

export function SkillForm({
  draft,
  focar,
  onDraft,
  plugin,
}: {
  draft: SkillDraft;
  /** O campo do nome toma o foco (a folha acabou de abrir neste nível). */
  focar: boolean;
  onDraft: (d: SkillDraft) => void;
  plugin: AxxaPlugin;
}) {
  const set = (campo: Partial<SkillDraft>) => onDraft({ ...draft, ...campo });
  const [procurando, setProcurando] = useState(false);
  /** Qual campo está com a assistente aberta. Um de cada vez: dois painéis no
   *  mesmo formulário seriam duas conversas disputando os mesmos campos. */
  const [ajudando, setAjudando] = useState<"" | "body" | "desc">("");
  const { indisponivel, pedirSkill, pedirDescricao, alvo, modelos, escolherModelo } = useAssistant(plugin);
  const cor = projectColor(draft.color);

  // Procurar ícone toma a tela, como nos projetos. Aqui nem a cor sobra: skill
  // não tem paleta, então fica o voltar e os ícones. Sair de cima de um
  // textarea de sete linhas também evita o pior esbarrão possível — o que
  // apaga o prompt inteiro.
  if (procurando)
    return (
      <SheetIconCatalog
        value={draft.icon}
        tint={cor}
        onBack={() => setProcurando(false)}
        onPick={(icon) => set({ icon })}
      >
        <SheetField label="Color">
          <SheetSwatches
            colors={PROJECT_COLORS}
            value={draft.color}
            resolve={projectColor}
            onPick={(color) => set({ color })}
          />
        </SheetField>
      </SheetIconCatalog>
    );

  return (
    <>
      {/* O skill como ele vai aparecer na lista. Não é enfeite: é o que faz o
          seletor de ícone e a descrição terem sentido antes de salvar —
          senão são dois campos que só se explicam depois. */}
      <div className="axxa-form-preview">
        <span
          className="axxa-thing-mark"
          style={{ color: cor }}
          aria-hidden="true"
        >
          <Icon name={draft.icon || "sparkles"} size={20} />
        </span>
        <span className="axxa-thing-text">
          <span className="axxa-thing-name">
            {draft.name.trim() || "Untitled skill"}
          </span>
          <span className="axxa-thing-note">
            {draft.description.trim() ||
              (draft.body.trim()
                ? draft.body.trim().split("\n")[0]
                : "No prompt yet")}
          </span>
        </span>
      </div>

      <SheetField label="Name">
        <SheetInput
          value={draft.name}
          placeholder="Weekly review"
          autoFocus={focar}
          onChange={(name) => set({ name })}
        />
      </SheetField>

      {/* O campo que IMPORTA, e por isso vem antes dos enfeites: sem corpo o
          parser descarta a nota e o skill some da lista no mesmo segundo em
          que foi criado. */}
      <SheetField
        label="Prompt"
        hint="What gets written for you when you use the skill."
      >
        {/* A assistente mora DENTRO deste campo: é ele que ela escreve, e é
            olhando pra ele vazio que a pessoa percebe que não sabe começar. */}
        <ComAssistente
          aberto={ajudando === "body"}
          onAbrir={() => setAjudando("body")}
          painel={
            <AssistantPanel
              para="skill"
              indisponivel={indisponivel}
              modelo={{
                atual: alvo?.model ?? "",
                opcoes: modelos,
                onTrocar: (m) => void escolherModelo(m),
              }}
              onFechar={() => setAjudando("")}
              onPedir={async (modo, turnos) => {
                const r = await pedirSkill(modo, turnos);
                if (r.draft) {
                  // PREENCHE, não salva: o resultado cai nos mesmos campos
                  // que a pessoa já estava olhando, e ela edita o que quiser.
                  set(r.draft);
                  return { pronto: true };
                }
                return { pergunta: r.pergunta, erro: r.erro };
              }}
            />
          }
        >
          <SheetTextarea
            comSpark
            value={draft.body}
            rows={7}
            placeholder={
              "Go through this week's notes and tell me:\n- what moved\n- what stalled\n- what I should drop"
            }
            onChange={(body) => set({ body })}
          />
        </ComAssistente>
      </SheetField>

      <SheetField label="Description" hint="One line, shown in the list.">
        {/* Aqui ela escreve A PARTIR do que já está na tela: o prompt acima é
            a matéria-prima, então o botão nasce ligado e o campo de entrada
            vira ajuste fino em vez de requisito. */}
        <ComAssistente
          aberto={ajudando === "desc"}
          onAbrir={() => setAjudando("desc")}
          painel={
            <AssistantPanel
              para="description"
              indisponivel={indisponivel}
              modelo={{
                atual: alvo?.model ?? "",
                opcoes: modelos,
                onTrocar: (m) => void escolherModelo(m),
              }}
              onFechar={() => setAjudando("")}
              onPedir={async (modo, turnos) => {
                const r = await pedirDescricao(
                  { name: draft.name, body: draft.body },
                  turnos
                );
                if (r.draft) {
                  set({ description: r.draft });
                  return { pronto: true };
                }
                return { pergunta: r.pergunta, erro: r.erro };
              }}
            />
          }
        >
          <SheetInput
            comSpark
            value={draft.description}
            placeholder="Optional"
            onChange={(description) => set({ description })}
          />
        </ComAssistente>
      </SheetField>

      {/* "Opens in" e não "Mode": o que a pessoa escolhe aqui é ONDE o skill
          vai cair quando ela tocar nele. */}
      <SheetField
        label="Opens in"
        hint="Using the skill switches to this mode."
      >
        <SheetChoices
          label="Mode"
          value={draft.mode}
          onPick={(mode) => set({ mode })}
          items={[
            { id: "", label: "Wherever I am" },
            ...CHAT_MODES.map((m) => ({
              id: m,
              label: MODULES[m].short,
              icon: MODULES[m].icon,
            })),
          ]}
        />
      </SheetField>

      {/* A cor vem ANTES do ícone, como nos projetos: ela decide como cada
          ícone aparece, e escolher o desenho antes do tom é escolher no
          escuro. */}
      <SheetField label="Color">
        <SheetSwatches
          colors={PROJECT_COLORS}
          value={draft.color}
          resolve={projectColor}
          onPick={(color) => set({ color })}
        />
      </SheetField>

      <SheetField label="Icon">
        <SheetIconGrid
          icons={SKILL_ICONS}
          value={draft.icon}
          tint={cor}
          onBrowse={() => setProcurando(true)}
          onPick={(icon) => set({ icon })}
        />
      </SheetField>

    </>
  );
}
