export const app_routes: Record<string, any> = {
  post: {
    home: "/(tabs)/(home)",
    compose: "/compose",
    edit: (id: string) => `/(tabs)/(home)/post/${id}/edit`,
    view: (id: string) => `/(tabs)/(home)/(post)/${id}`,
    view_media: (id: string) => `/(tabs)/(home)/(post)/media/${id}`,
  },
  profile: {
    root: "/(tabs)/(profile)",
    view: (id: string) => `/(tabs)/(profile)/${id}`,
    edit: "/(tabs)/(profile)/edit",
    signOut: "/(profile)/sign-out",
  },
  history: {
    root: "/(tabs)/(history)",
  },
  auth: {
    login: "/(auth)/login",
    register: "/(auth)/register",
    forgot_password: "/(auth)forgot-password",
  },
  messages: {
    root: "/(tabs)/(messages)",
    new: "/(tabs)/(messages)/new",
    room: (opts: { r?: string; u?: string }) => {
      const q = new URLSearchParams();
      if (opts.r) q.set("r", opts.r);
      if (opts.u) q.set("u", opts.u);
      const s = q.toString();
      return s ? `/(tabs)/(messages)/room?${s}` : "/(tabs)/(messages)/room";
    },
  },
};
