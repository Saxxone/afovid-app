import type { DateString, MediaType } from "./types";
import type { Author, User } from "./user";

export interface Post {
  id: string;
  createdAt?: DateString | null;
  updatedAt?: DateString | null;
  text: string | null | undefined;
  author: Partial<Author>;
  published: boolean;
  authorId: string;
  media: string[];
  mediaTypes: MediaType[];
  likedBy: Partial<User>[];
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  bookmarkedBy: User[];
  comments?: Post[];
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  parentId: string | null | undefined;
  parent?: Post;
  type: PostType;
  longPost: Partial<LongPost> | null | undefined;
  longPostId: string | null | undefined;
  deletedAt: DateString | null;
}
export type PostType = "LONG" | "SHORT";

export interface LongPost {
  id?: string | null;
  content: Partial<LongPostBlock>[];
  author?: Partial<Author>;
  authorId: string | null | undefined;
}

export interface LongPostBlock {
  id?: string | null;
  longPostId?: string | null;
  text: string;
  media: string[];
  mediaTypes?: MediaType[];
}

export function postContainsVideo(post: Post): boolean {
  if (post.type === "SHORT") {
    return post.mediaTypes?.some((t) => t === "video") ?? false;
  }
  const blocks = post.longPost?.content;
  if (!blocks?.length) return false;
  return blocks.some(
    (block) => block.mediaTypes?.some((t) => t === "video") ?? false,
  );
}
