// src/i18n/ui-pt/projetos.ts
// pt-BR da interface: projetos, skills, a assistente de criação e as folhas (Sheet).
// Chave = o texto em inglês do código (ver i18n/tr.ts). As {variáveis} da
// chave têm que aparecer na tradução — o teste de cobertura confere.
//
// "Skill" é feminino (a skill, uma skill) e a assistente também (ela). Chave
// que aparece em mais de um arquivo mora no primeiro grupo em que aparece; as
// que existem também em outra área (Back, Delete, Exported to…, Added to…,
// Add to project, All, 1 chat…) têm o MESMO texto de lá — no dicionário montado,
// a última parte a definir uma chave é a que vale.

export const PT_PROJETOS: Record<string, string> = {
  // ProjectsView.tsx
  "Delete project \"{name}\"?": "Apagar o projeto \"{name}\"?",
  "The notes and chats stay where they are — only the grouping goes.":
    "As notas e as conversas ficam onde estão — só o agrupamento sai.",
  "Delete": "Apagar",
  "Duplicated as \"{name}\"": "Duplicado como \"{name}\"",
  "Exported to {path}": "Exportada pra {path}",
  "Could not export: {error}": "Não deu pra exportar: {error}",
  "New chat here": "Nova conversa aqui",
  "Instructions": "Instruções",
  "Notes": "Notas",
  "Edit": "Editar",
  "Duplicate": "Duplicar",
  "Export to vault": "Exportar pro vault",
  "Not found: {path}": "Não encontrada: {path}",
  "Edit project": "Editar projeto",
  "New project · {step}": "Novo projeto · {step}",
  "Custom instructions": "Instruções personalizadas",
  "Add a note": "Adicionar nota",
  "Project notes": "Notas do projeto",
  "Project": "Projeto",
  "Add to project": "Adicionar a um projeto",
  "Projects": "Projetos",
  "Create project": "Criar projeto",
  "Save project": "Salvar projeto",
  "Save instructions": "Salvar instruções",
  "Project settings": "Configurações do projeto",
  "New project": "Novo projeto",
  // O "+ New" da barra, nas folhas de projetos E de skills (skill é feminino):
  // "Novo" como rótulo genérico de criar, igual ao "+ Novo" do Google Drive.
  "New": "Novo",
  "Sent with every new chat in this project — it adds to how the app already works, it does not replace it.":
    "Vão junto em toda conversa nova deste projeto — somam ao jeito como o app já funciona, não substituem.",
  "Answer in Portuguese.\nCite the note you took it from.\nShort paragraphs, no bullet lists.":
    "Responda em português.\nCite a nota de onde tirou.\nParágrafos curtos, sem listas de tópicos.",
  "Search notes": "Buscar notas",
  "No note matches that.": "Nenhuma nota bate com isso.",
  "Remove {path}": "Remover {path}",
  "No notes yet. What you add here goes in as context on every new chat in this project.":
    "Nenhuma nota ainda. O que você adicionar aqui vai como contexto em toda conversa nova deste projeto.",
  "Lives in this vault · since {date}": "Mora neste vault · desde {date}",
  "Pick the notes this project is about. They go in as context every time you start a chat here.":
    "Escolha as notas sobre o assunto deste projeto. Elas vão como contexto toda vez que você começa uma conversa aqui.",
  "1 note goes in as context on every new chat here.":
    "1 nota vai como contexto em toda conversa nova aqui.",
  "{n} notes go in as context on every new chat here.":
    "{n} notas vão como contexto em toda conversa nova aqui.",
  "Nothing yet": "Nada ainda",
  "1 note": "1 nota",
  "{n} notes": "{n} notas",
  "Add notes": "Adicionar notas",
  "See notes": "Ver notas",
  "Add instructions": "Adicionar instruções",
  "Chats": "Conversas",
  "Ask anything. Chats in this project show up here.":
    "Pergunte qualquer coisa. As conversas deste projeto aparecem aqui.",
  "Added to {name}.": "Adicionada a {name}.",
  "Already here": "Já está aqui",
  "No instructions yet": "Sem instruções ainda",
  "1 chat": "1 conversa",
  "{n} chats": "{n} conversas",
  "Input tokens each new chat here starts with: the instructions plus the full text of its notes.":
    "Tokens de entrada com que cada conversa nova aqui começa: as instruções mais o texto inteiro das notas.",
  "Actions for {name}": "Ações de {name}",
  "A project keeps notes and chats about the same thing together. Its notes go in as context every time you start a chat there.":
    "Um projeto junta notas e conversas sobre o mesmo assunto. As notas dele vão como contexto toda vez que você começa uma conversa ali.",

  // ProjectSheet.tsx (os rótulos dos passos do wizard também vão no título)
  "Name": "Nome",
  "Color": "Cor",
  "Icon": "Ícone",
  "Untitled project": "Projeto sem título",
  "No notes yet": "Nenhuma nota ainda",
  // O pé do cartão de prévia: "3 notas · instruções".
  "instructions": "instruções",
  "Or describe it and let ✨ set up the whole project.":
    "Ou descreva e deixe o ✨ montar o projeto inteiro.",
  "Thesis, Client X, Apartment…": "Tese, Cliente X, Apartamento…",
  "What this project should know — they go in as context on every chat started in it.":
    "O que este projeto deve saber — elas vão como contexto em toda conversa começada nele.",
  "Find notes for me": "Ache notas pra mim",
  "Search notes to add": "Buscar notas pra adicionar",
  "Let ✨ see your note names": "Deixar o ✨ ver os nomes das suas notas",
  "Only titles and folders — never what is inside a note.":
    "Só títulos e pastas — nunca o que está dentro de uma nota.",
  "In your vault": "No seu vault",
  "Add {path}": "Adicionar {path}",
  "In this project": "Neste projeto",
  "No notes yet. Search above, or tap ✨ to have the assistant find them. You can also skip this and add notes later.":
    "Nenhuma nota ainda. Busque acima, ou toque no ✨ pra assistente achar. Você também pode pular isto e adicionar notas depois.",

  // SkillsView.tsx
  "All": "Tudo",
  "Could not save the skill: {error}": "Não deu pra salvar a skill: {error}",
  "Delete \"{name}\"?": "Apagar \"{name}\"?",
  "The note goes to the trash — you can get it back from there.":
    "A nota vai pra lixeira — dá pra recuperar de lá.",
  "1 example skill created.": "1 skill de exemplo criada.",
  "{n} example skills created.": "{n} skills de exemplo criadas.",
  "The examples are already here.": "Os exemplos já estão aqui.",
  "Create skill": "Criar skill",
  "Save skill": "Salvar skill",
  "New skill": "Nova skill",
  "New skill · {step}": "Nova skill · {step}",
  "Edit skill": "Editar skill",
  "Skills": "Skills",
  "Filter skills by mode": "Filtrar skills por modo",
  "Search skills": "Buscar skills",
  // {time} é o tempo curto da lista de conversas: "agora", "5h", "3d" ou a data.
  "Edited {time}": "Editada · {time}",
  "Prompt": "Prompt",
  "Use": "Usar",
  "Open note": "Abrir nota",
  "Nothing matches that.": "Nada bate com isso.",
  "A skill is a prompt you keep. Write it once, use it in one tap — here, in the composer’s +, or by typing / in any chat.":
    "Uma skill é um prompt que você guarda. Escreva uma vez, use com um toque — aqui, no + do campo de mensagem, ou digitando / em qualquer conversa.",
  "Start with three examples": "Começar com três exemplos",

  // SkillSheet.tsx
  "Description": "Descrição",
  "Opens in": "Abre em",
  "Untitled skill": "Skill sem título",
  "No prompt yet": "Nenhum prompt ainda",
  "How you'll find it in the list.": "É assim que você vai achar a skill na lista.",
  "Weekly review": "Revisão semanal",
  "What gets written for you when you use the skill.":
    "O que é escrito pra você ao usar a skill.",
  "Go through this week's notes and tell me:\n- what moved\n- what stalled\n- what I should drop":
    "Passe pelas notas desta semana e me diga:\n- o que andou\n- o que travou\n- o que eu devia largar",
  "One line, shown in the list.": "Uma linha, mostrada na lista.",
  "Optional": "Opcional",
  "Using the skill switches to this mode.": "Usar a skill muda pra este modo.",
  "Mode": "Modo",
  "Wherever I am": "Onde eu estiver",

  // SheetForm.tsx
  "{label}, {n} icons": "{label}, {n} ícones",
  "More icons — {n} to choose from": "Mais ícones — {n} pra escolher",
  "More": "Mais",
  "Icon category": "Categoria de ícone",
  "Step {n} of {total}": "Passo {n} de {total}",
  // {label} é o botão que conclui: "Criar skill agora".
  "{label} now": "{label} agora",
  "Next": "Avançar",

  // Sheet.tsx
  "Drag to resize": "Arraste pra redimensionar",
  "Back": "Voltar",
  "Close": "Fechar",

  // SearchField.tsx (a contagem na ponta do campo; "literal" = a expressão
  // não compilou e virou busca literal)
  "1 found": "1 achado",
  "{n} found": "{n} achados",
  "literal": "literal",

  // AssistantPanel.tsx
  "Describe the skill you want, in a line.": "Descreva a skill que você quer, numa linha.",
  "What is this project about?": "Sobre o que é este projeto?",
  "Anything to steer it? (optional)": "Algo pra orientar? (opcional)",
  "Anything to look for? (optional)": "Algo pra procurar? (opcional)",
  "A weekly review that reads my notes and tells me what stalled":
    "Uma revisão semanal que lê minhas notas e me diz o que travou",
  "My master's thesis on Kuhn and scientific revolutions":
    "Minha dissertação de mestrado sobre Kuhn e as revoluções científicas",
  "Optional — it writes from the prompt above":
    "Opcional — ela escreve a partir do prompt acima",
  "Optional — it writes from the project and its notes":
    "Opcional — ela escreve a partir do projeto e das notas dele",
  "Optional — it looks at the project's name and instructions":
    "Opcional — ela olha o nome e as instruções do projeto",
  "Write it for me": "Escreva pra mim",
  "Write it": "Escrever",
  "Find them": "Achar",
  "Writing with {model}": "Escrevendo com {model}",
  "{model} · free": "{model} · grátis",
  "Let me type": "Eu escrevo",
  "Or say it your way…": "Ou diga do seu jeito…",
  "Grill me": "Me pergunte",
  "Options": "Opções",
  "Send": "Enviar",
  "You can close this — it keeps writing.": "Pode fechar — ela continua escrevendo.",
  "{title} — writing…": "{title} — escrevendo…",

  // useAssistant.ts — o que a assistente diz quando não deu
  "Assistant not available.": "Assistente indisponível.",
  "The assistant did not write a prompt. Try saying more.":
    "A assistente não escreveu um prompt. Tente dizer mais.",
  "The assistant did not name the project. Try saying more.":
    "A assistente não deu nome ao projeto. Tente dizer mais.",
  "The assistant came back empty. Try again, or say more.":
    "A assistente voltou sem nada. Tente de novo, ou diga mais.",
  "Let the assistant see your note names first (below) — it never reads what is inside them.":
    "Deixe a assistente ver os nomes das suas notas primeiro (abaixo) — ela nunca lê o que tem dentro delas.",
  "No note in the vault fits yet — try naming the project, or saying what it is about.":
    "Nenhuma nota do vault se encaixa ainda — tente dar um nome ao projeto, ou dizer do que ele trata.",

  // projectSummary.ts — o cartão de um projeto
  "just now": "agora mesmo",
  "{time} ago": "há {time}",
  "Latest: {title}": "Última: {title}",
  "0 tokens": "0 tokens",
  "~{n} tokens": "~{n} tokens",
  "~{n}k tokens": "~{n}k tokens",

  // projects.ts e skills/skillFile.ts — o que falta pra salvar, e o nome da cópia
  "Give it a name.": "Dê um nome.",
  "There is already a project with that name.": "Já existe um projeto com esse nome.",
  "{name} copy": "{name} cópia",
  "{name} copy {n}": "{name} cópia {n}",
  "Write the prompt — that is what the skill is.": "Escreva o prompt — é isso que a skill é.",
  "There is already a skill with that name.": "Já existe uma skill com esse nome.",

  // assistant/model.ts, run.ts, store.ts — por que ela não está disponível, ou não respondeu
  "Pick an assistant model in Settings — a free OpenRouter model works.":
    "Escolha um modelo pra assistente nas Configurações — um modelo grátis do OpenRouter serve.",
  "Add your {provider} key in Settings to use the assistant.":
    "Adicione sua chave do {provider} nas Configurações pra usar a assistente.",
  "The assistant could not answer.": "A assistente não conseguiu responder.",
  "The assistant answered in prose instead of the expected format. A stronger model usually fixes it.":
    "A assistente respondeu em texto corrido em vez do formato esperado. Um modelo mais forte costuma resolver.",
};
