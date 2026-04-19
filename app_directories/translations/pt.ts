/** Partial Portuguese copy; missing keys fall back to English via i18n-js. */
const pt = {
  common: {
    error: "Erro",
  },
  navigation: {
    home: "Início",
    explore: "Pesquisar",
    history: "Histórico",
    messages: "Mensagens",
    notifications: "Notificações",
    profile: "Perfil",
  },
  home: {
    empty_feed: "Sem publicações.",
  },
  posts: {
    display_error: "Não foi possível mostrar a publicação.",
  },
  explore: {
    placeholder: "Pesquisar",
    no_results: "Nenhum resultado encontrado",
    page_title: "Pesquisar",
    hint_empty: "Pesquise publicações",
  },
  history: {
    page_title: "Histórico",
    tab_history: "Histórico",
    tab_liked: "Gostos",
    tab_paid: "Pagos",
    empty_history:
      "Ainda sem histórico. Abra uma publicação com vídeo e assista alguns segundos.",
    empty_liked: "Ainda sem vídeos com gosto.",
    empty_paid: "Ainda sem conteúdo desbloqueado.",
    login_prompt:
      "Inicie sessão para ver o histórico, vídeos com gosto e conteúdo pago.",
  },
  notifications: {
    no_results: "Sem notificações",
    page_title: "Notificações",
    mark_all_read: "Marcar lidas",
    open_post: "Abrir publicação",
  },
  login: {
    welcome: "Entre na sua conta",
    email_username: "E-mail ou nome de utilizador",
    password: "Palavra-passe",
    login: "Entrar",
    forgot_password: "Esqueceu a palavra-passe?",
    create_account: "Ainda não tem conta?",
    sign_up: "Registar",
    page_title: "Entrar",
    required_fields:
      "E-mail ou nome de utilizador e palavra-passe são obrigatórios.",
    login_failed: "Não foi possível iniciar sessão. Tente novamente.",
    validation_password_required: "A palavra-passe é obrigatória.",
    validation_password_min:
      "A palavra-passe deve ter pelo menos 4 caracteres.",
    validation_username_required: "O nome de utilizador é obrigatório.",
  },
  messages: {
    no_results: "Sem conversas",
    page_title: "Mensagens",
  },
  chat: {
    page_title: "Chat",
    direct_message: "Mensagem direta",
    new: "Diga algo…",
    missing_peer_key: "Este utilizador ainda não configurou encriptação.",
    encryption_failed: "Não foi possível encriptar a mensagem.",
    send_failed: "Não foi possível enviar a mensagem.",
    setup_keys_hint:
      "A encriptação extremo-a-extremo precisa de chaves neste dispositivo. Gere chaves para continuar.",
    generate_keys: "Gerar chaves de encriptação",
  },
  profile: {
    edit: "Editar perfil",
  },
  not_found: {
    title: "Este ecrã não existe.",
    go_home: "Ir para o início",
  },
};

export default pt;
