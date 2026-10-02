// src/ui/ChatInstructionsSheet.tsx
// As INSTRUÇÕES de uma conversa — aberto pelo ⋯ dela.
//
// A conversa já guardava instruções no próprio arquivo (`instructions:`): as
// que ela herda do projeto onde nasceu. Elas SOMAM ao prompt do app nos três
// modos — chat, Vault Q&A e agente — e por isso são o lugar certo pro "faça
// assim nesta conversa". A `persona`, que o motor também lê, SUBSTITUI o
// prompt do app e levaria junto as regras dele (idioma, como citar nota, o
// que o agente pode mexer); ela continua valendo pra quem editar o .md à mão.

import { useEffect, useState } from "react";
import { Notice } from "obsidian";
import type AxxaPlugin from "../main";
import type { ChatSummary } from "../core/chatPersistence";
import { loadChat, setChatInstructions } from "../core/chatPersistence";
import { useChatStore } from "../store/chat";
import { Sheet } from "./Sheet";
import { SheetField, SheetSubmit, SheetTextarea } from "./SheetForm";

export function ChatInstructionsSheet({
  plugin,
  chat,
  open,
  onClose,
}: {
  plugin: AxxaPlugin;
  chat: ChatSummary | null;
  open: boolean;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [pronto, setPronto] = useState(false);

  // O texto de agora: o da SESSÃO quando é a conversa aberta (pode estar à
  // frente do arquivo), senão o do arquivo.
  useEffect(() => {
    if (!open || !chat) return;
    let vivo = true;
    setPronto(false);
    const st = useChatStore.getState();
    if (st.currentChatId === chat.id) {
      setTexto(st.sessionInstructions ?? "");
      setPronto(true);
      return;
    }
    void loadChat(plugin.app, plugin.settings.chatsPath, chat.mode, chat.id)
      .then((d) => {
        if (!vivo) return;
        setTexto(d.instructions ?? "");
        setPronto(true);
      })
      .catch(() => {
        if (!vivo) return;
        setTexto("");
        setPronto(true);
      });
    return () => {
      vivo = false;
    };
  }, [open, chat?.id]);

  const salvar = async () => {
    if (!chat || !pronto) return;
    const limpo = texto.trim();
    try {
      await setChatInstructions(
        plugin.app,
        plugin.settings.chatsPath,
        chat.mode,
        chat.id,
        limpo
      );
      // Conversa aberta: a próxima resposta já sai com elas, e a próxima
      // gravação da sessão não desfaz o que foi escrito aqui.
      const st = useChatStore.getState();
      if (st.currentChatId === chat.id) st.setSessionInstructions(limpo);
      new Notice(
        limpo ? "Instructions saved for this chat." : "Instructions removed from this chat."
      );
      onClose();
    } catch (err) {
      new Notice(
        `Could not save the instructions: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  return (
    <Sheet
      title="Instructions"
      mark={{ icon: "scroll-text" }}
      open={open}
      onClose={onClose}
      footer={
        <SheetSubmit
          label="Save instructions"
          problema={pronto ? null : "Loading…"}
          onSubmit={() => void salvar()}
        />
      }
    >
      <SheetField
        label={chat ? chat.title || "Untitled" : ""}
        hint="Added to the assistant's own rules in every reply of this chat — like a project's instructions, they don't replace them. Leave it empty to remove."
      >
        <SheetTextarea
          value={texto}
          rows={8}
          placeholder="e.g. Answer in short bullet points and cite the note behind every claim."
          autoFocus={open && pronto}
          onChange={setTexto}
        />
      </SheetField>
    </Sheet>
  );
}
