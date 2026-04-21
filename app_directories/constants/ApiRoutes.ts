import { getExpoPublicApiBase, getExpoPublicWsUrl } from "./envPublic";

const ws = getExpoPublicWsUrl();
const api_url = getExpoPublicApiBase();
const api_routes = {
  login: api_url + "/auth/login",
  google_login: api_url + "/auth/login/google",
  google_signup: api_url + "/auth/signup/google",
  logout: api_url + "/auth/logout",
  register: api_url + "/user/register",
  token_refresh: api_url + "/auth/refresh",
  posts: {
    base: api_url + "/posts",
    feed: api_url + "/posts/feed",
    create_post: api_url + "/posts/create-post",
    create_draft: api_url + "/posts/create-draft",
    update: (id: string) => api_url + `/posts/publish/${id}`,
    like: (id: string) => api_url + `/posts/like/${id}`,
    checkLike: (id: string) => api_url + `/posts/check-like/${id}`,
    bookmark: (id: string) => api_url + `/posts/bookmark/${id}`,
    checkBookmark: (id: string) => api_url + `/posts/check-bookmark/${id}`,
    getPostById: (id: string) => api_url + `/posts/${id}`,
    getComments: (id: string) => api_url + `/posts/comments/${id}`,
    getUserPosts: (id: string) => api_url + `/posts/user/${id}/posts`,
    getSearchResults: (search: string) => api_url + `/posts/search?q=${search}`,
    delete: (id: string) => api_url + `/posts/${id}`,
    recordWatch: (id: string) =>
      api_url + `/posts/watch/${encodeURIComponent(id)}`,
    myWatchHistory: api_url + "/posts/me/watch-history",
    myLikedVideos: api_url + "/posts/me/liked-videos",
    myUnlocked: api_url + "/posts/me/unlocked",
  },
  files: {
    upload: api_url + "/file/upload",
    get: (id: string) => `${api_url}/file/${encodeURIComponent(id)}`,
  },
  notifications: {
    get: api_url + "/notifications",
    sse: api_url + "/notifications/sse",
    readAll: api_url + "/notifications/read-all",
    update: (id: string) => api_url + `/notifications/${id}`,
    delete: (id: string) => api_url + `/notifications/${id}`,
    pushToken: api_url + "/notifications/push-token",
  },
  chats: {
    base: ws, // Websocket URLs are handled differently
    create: ws + "/create", // Websocket URLs are handled differently
    delete: (id: string) => api_url + `/chats/delete/${id}`,
  },
  room: {
    rooms: api_url + "/rooms/all",
    findRoomByParticipantsOrCreate: (id: string, id2: string) =>
      api_url + `/rooms/find-create/?user1=${id}&user2=${id2}`,
    chats: (id: string) => api_url + `/rooms/chats/${id}`,
    room: (id: string) => api_url + `/rooms/${id}`,
    update: (id: string) => api_url + `/rooms/update/${id}`,
  },
  users: {
    get: (id: string) => api_url + `/user/${id}`,
    update: (id: string) => api_url + `/user/update/${id}`,
    search: (search: string, withPk = true) =>
      `${api_url}/user/search?q=${encodeURIComponent(search)}&with_pk=${withPk}`,
  },
  coins: {
    packages: api_url + "/coins/packages",
    balance: api_url + "/coins/balance",
    quote: (postId: string) =>
      api_url + `/coins/quote/${encodeURIComponent(postId)}`,
    unlock: (postId: string) =>
      api_url + `/coins/unlock/${encodeURIComponent(postId)}`,
    checkoutStripe: api_url + "/coins/checkout/stripe",
  },
};

export default api_routes;
