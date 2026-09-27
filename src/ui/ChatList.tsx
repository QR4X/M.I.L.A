// src/ui/ChatList.tsx
// A lista de conversas de uma home: cartão com brasão, título, uma linha de
// estado e a idade na ponta direita — o formato dos prints da referência.
//
// Ela morava dentro da gaveta, como linha apertada de menu. Saiu de lá porque
// a lista de um módulo pertence à HOME daquele módulo, e numa página inteira
// cabe dizer o que cada conversa É: quantas ações rodou, com qual modelo, e
// quando foi.

import { useEffect, useState } from "react";
import { Notice } from "obsidian";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import { loadChat, setChatStarred } from "../core/chatPersistence";
import { exportChatToVault } from "../core/chatExport";
import { usePainel } from "./painel";
import { useChatStore } from "../store/chat";
import { PROVIDERS } from "../core/providersMeta";
import { Icon } from "./Icon";
import { openActions } from "./menu";
import { PromptModal, ConfirmModal } from "./modals";
import { relativeShort } from "./modules";
import { ALERT_LABEL, chatAlert } from "./chatAlert";

/** Logo do provider da conversa. Desconhecido cai num ícone neutro em vez de
 *  quebrar o setIcon com um nome que não existe.
 *  Exportado porque o cartão de uso da home mostra o mesmo brasão pro modelo
 *  favorito — dois jeitos de desenhar o mesmo provider seria um a mais. */
export function providerIcon(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.icon ?? "message-square";
}

/**
 * As conversas gravadas, sempre frescas. O cache mora no plugin (índice em
 * disco + varredura em segundo plano); aqui só se assina a mudança.
 */
export function useChatSummaries(plugin: AxxaPlugin): ChatSummary[] {
  const [chats, setChats] = useState<ChatSummary[]>(plugin.chatSummaries ?? []);
  useEffect(() => {
    let vivo = true;
    void plugin.loadChatSummaries().then((all) => {
      if (vivo) setChats(all);
    });
    const unsub = plugin.onChatsChange(() =>
      setChats(plugin.chatSummaries ?? []),
    );
    return () => {
      vivo = false;
      unsub();
    };
  }, [plugin]);
  return chats;
}

/**
 * As conversas que responderam sem ninguém ver.
 *
 * Guarda um Set NOVO a cada aviso de propósito: é a identidade diferente que
 * faz o React redesenhar. Ler `plugin.settings.unreadChats` direto no render
 * lia o valor certo e não redesenhava nunca.
 */
export function useUnreadChats(plugin: AxxaPlugin): Set<string> {
  const [naoLidas, setNaoLidas] = useState<Set<string>>(() =>
    plugin.unreadSet(),
  );
  useEffect(() => {
    setNaoLidas(plugin.unreadSet());
    return plugin.onUnreadChange(() => setNaoLidas(plugin.unreadSet()));
  }, [plugin]);
  return naoLidas;
}

/**
 * O que a sessão do Agent FEZ. Só o Agent tem essa linha: numa lista de
 * sessões o que distingue uma da outra é o trabalho que rodou. Nos outros
 * módulos o cartão diz só o modelo, que é o que a pessoa pediu.
 *
 * Nada aqui é decorativo: o verde só aparece quando houve ação de verdade.
 */
function acoes(c: ChatSummary): { texto: string; ativo: boolean } | null {
  if (c.mode !== "agent") return null;
  if (c.toolCount > 0) {
    return {
      texto: c.toolCount === 1 ? "1 action" : `${c.toolCount} actions`,
      ativo: true,
    };
  }
  return { texto: "No actions", ativo: false };
}

export function ChatList({
  plugin,
  session,
  chats,
  onOpen,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  chats: ChatSummary[];
  /** Chamado DEPOIS de mandar carregar — pra quem precisa fechar algo. */
  onOpen?: (chat: ChatSummary) => void;
}) {
  const currentChatId = useChatStore((s) => s.currentChatId);
  // Quem está respondendo AGORA — inclusive se for uma conversa que não está
  // na tela. É a única informação desta lista que não vem do disco.
  const respondendo = useChatStore((s) => s.isLoading);
  const turnChatId = useChatStore((s) => s.turnChatId);
  const esperandoId = useChatStore((s) => s.waitingChatId);
  const naoLidas = useUnreadChats(plugin);
  const painel = usePainel();

  const abrir = (c: ChatSummary) => {
    void session.load(c);
    onOpen?.(c);
  };

  const renomear = async (c: ChatSummary) => {
    const title = await new PromptModal(plugin.app, {
      title: "Rename chat",
      label: "Title",
      initial: c.title,
      submitLabel: "Rename",
    }).openAndWait();
    if (title && title !== c.title) await session.rename(c, title);
  };

  /** Favoritar: mexe só na linha `starred:` do frontmatter (a conversa pode
   *  ter mil linhas de corpo). Depois recarrega a lista, que é quem exibe. */
  const favoritar = async (c: ChatSummary) => {
    try {
      await setChatStarred(
        plugin.app,
        plugin.settings.chatsPath,
        c.mode,
        c.id,
        !c.starred
      );
      await plugin.loadChatSummaries(true);
    } catch (err) {
      new Notice(
        `Could not star: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  /** Deixar pra depois: a marca é a MESMA que uma resposta chegando sem você
   *  ver cria (o ponto na aba). Aqui ela vira gesto voluntário. */
  const deixarNaoLida = (c: ChatSummary) => {
    plugin.markChatUnread(c.id);
    new Notice("Marked as unread.");
  };

  /** Exportar: a conversa mora em `.axxa/chats`, pasta que o Obsidian ignora —
   *  esta é a única ponte entre ela e o vault (ver core/chatExport.ts). */
  const exportar = async (c: ChatSummary) => {
    try {
      const chat = await loadChat(
        plugin.app,
        plugin.settings.chatsPath,
        c.mode,
        c.id
      );
      const caminho = await exportChatToVault(plugin.app, chat);
      new Notice(`Exported to ${caminho}`);
    } catch (err) {
      new Notice(
        `Export failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  /** Pôr a conversa num projeto — o segundo nível do menu. */
  const paraProjeto = async (c: ChatSummary, projectId: string) => {
    await session.updateProjects((prev) =>
      prev.map((p) =>
        p.id === projectId && !p.chatIds.includes(c.id)
          ? { ...p, chatIds: [c.id, ...p.chatIds] }
          : p
      )
    );
    const nome =
      (plugin.settings.projects ?? []).find((p) => p.id === projectId)?.name ??
      "project";
    new Notice(`Added to ${nome}.`);
  };

  const apagar = async (c: ChatSummary) => {
    const ok = await new ConfirmModal(plugin.app, {
      title: `Delete "${c.title || "Untitled"}"?`,
      body: "The chat file goes to the system trash (recoverable).",
      confirmLabel: "Delete",
      danger: true,
    }).openAndWait();
    if (ok) await session.delete(c);
  };

  return (
    <div className="axxa-history">
      {chats.map((c) => {
        const st = acoes(c);
        const alerta = chatAlert({
          esperando: esperandoId === c.id,
          rodando: respondendo && turnChatId === c.id,
          naoLida: naoLidas.has(c.id),
        });
        return (
          <div
            key={c.id}
            className={[
              "axxa-history-row",
              // A roupa vem do MÓDULO, não da tela onde a lista está:
              // conversa é fala e vira LINHA; sessão de vault ou de agente é
              // um objeto com estado e vira CARTÃO. Assim a mesma conversa
              // se parece consigo mesma em qualquer lugar do app — inclusive
              // no histórico, onde os três se misturam.
              c.mode === "chat" ? "is-flat" : "",
              // Cartão alto: o ⋯ precisa saber disso pra ficar na faixa de
              // cima em vez de boiar no meio da altura.
              c.mode === "agent" && c.preview ? "has-preview" : "",
              c.id === currentChatId ? "is-current" : "",
              alerta ? `has-alert is-${alerta}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              type="button"
              className="axxa-history-open"
              onClick={() => abrir(c)}
            >
              <span className="axxa-card-top">
                {/* O brasão é o LOGO DO PROVIDER, colorido: é o que diz de
                  relance com quem a conversa foi, sem gastar uma palavra. */}
                <span className="axxa-card-mark" aria-hidden="true">
                  <Icon name={providerIcon(c.provider)} size={20} />
                </span>

                <span className="axxa-card-text">
                  <span className="axxa-history-title">
                    {c.title || "Untitled"}
                  </span>
                  <span className="axxa-history-meta">
                    {/* O ponto pulsa e a palavra diz o que ele significa — um
                      ponto sozinho não se explica. */}
                    {alerta && (
                      <span className={`axxa-card-live is-${alerta}`}>
                        <span className="axxa-card-pulse" aria-hidden="true" />
                        {ALERT_LABEL[alerta]}
                      </span>
                    )}
                    {alerta && <span className="axxa-card-dot">·</span>}
                    {st && (
                      <span
                        className={
                          st.ativo ? "axxa-card-state is-on" : "axxa-card-state"
                        }
                      >
                        {st.texto}
                      </span>
                    )}
                    {st && c.model && <span className="axxa-card-dot">·</span>}
                    {c.model && <span>{c.model}</span>}
                  </span>
                </span>

              </span>

              {/* A última fala, no cartão da SESSÃO. Título e modelo dizem o
                  que ela é; isto diz onde ela parou — a pergunta de quem está
                  decidindo se volta. Só no Agent: numa conversa, o título já
                  é a primeira frase, e repetir a fala embaixo dele seria dizer
                  a mesma coisa duas vezes. */}
              {c.mode === "agent" && c.preview && (
                <span className="axxa-card-preview">{c.preview}</span>
              )}
            </button>

            {/* A COLUNA DA PONTA: o ⋯ em cima, a idade embaixo. Eles eram
                vizinhos na horizontal e disputavam a mesma faixa — a idade
                terminava em posições diferentes conforme o texto ("now", "2d",
                "2026-09-13"), então o ⋯ da linha de baixo nunca ficava
                debaixo do de cima. Empilhados e alinhados à direita, as duas
                colunas ficam retas de cima a baixo.

                Tempo desde a ÚLTIMA interação: `date` é reescrito a cada
                gravação da conversa, não é a data de criação. */}
            <span className="axxa-card-end">
            <button
              type="button"
              className="axxa-icon-btn axxa-history-more"
              aria-label={`Actions for ${c.title || "Untitled"}`}
              onClick={(e) =>
                openActions(e as unknown as MouseEvent, [
                  {
                    label: c.starred ? "Unstar" : "Star",
                    icon: c.starred ? "star-off" : "star",
                    run: () => void favoritar(c),
                  },
                  // Marcar como não lida só faz sentido na que NÃO está aberta
                  // e ainda não está marcada — nos outros casos o item existiria
                  // pra não fazer nada.
                  ...(c.id !== currentChatId && !naoLidas.has(c.id)
                    ? [
                        {
                          label: "Mark as unread",
                          icon: "dot",
                          run: () => deixarNaoLida(c),
                        },
                      ]
                    : []),
                  {
                    label: "Add to project",
                    icon: "folder-plus",
                    // O segundo nível: os projetos que existem e, no fim, a
                    // porta pra criar um. Sem projeto nenhum, a lista é só a
                    // porta — e aí ela se explica sozinha.
                    children: [
                      ...(plugin.settings.projects ?? []).map((p) => ({
                        label: p.name,
                        icon: p.icon,
                        checked: p.chatIds.includes(c.id),
                        run: () => void paraProjeto(c, p.id),
                      })),
                      {
                        label: "New project…",
                        icon: "plus",
                        run: () => painel.novoProjetoCom(c.id),
                      },
                    ],
                  },
                  {
                    label: "Export to vault",
                    icon: "file-down",
                    run: () => void exportar(c),
                  },
                  {
                    label: "Rename",
                    icon: "pencil",
                    run: () => void renomear(c),
                  },
                  {
                    label: "Delete",
                    icon: "trash-2",
                    danger: true,
                    run: () => void apagar(c),
                  },
                ])
              }
            >
              <Icon name="more-horizontal" />
            </button>
              <span className="axxa-card-age">{relativeShort(c.date)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
