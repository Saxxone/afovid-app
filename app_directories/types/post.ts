import type { DateString, MediaType } from "./types";
import type { Author, User } from "./user";

export interface PostMediaMetadata {
  fileId: string;
  sizeBytes: number;
  mimeType: string;
  originalFilename: string;
  requiresAuth: boolean;
  monetizationEnabled?: boolean;
  pricedCostMinor?: number | null;
  paywalled?: boolean;
  trailerUrl?: string | null;
  trailerPlayback?: string | null;
}

export interface Post {
  id: string;
  createdAt?: DateString | null;
  updatedAt?: DateString | null;
  text: string | null | undefined;
  author: Partial<Author>;
  published: boolean;
  authorId: string;
  media: string[];
  mediaPlayback?: string[];
  mediaMetadata?: PostMediaMetadata[];
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
  monetizationEnabled?: boolean;
  pricedCostMinor?: number | null;
  sourceStreamQuality?: string | null;
  quotedPost?: Post | null;
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
  mediaPlayback?: string[];
  mediaMetadata?: PostMediaMetadata[];
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

/** Monetized short post with video in feed: use trailer autoplay semantics (web `feedTrailerAutoplay`). */
export function postFeedTrailerAutoplay(post: Post): boolean {
  return (
    post.monetizationEnabled === true &&
    post.type === "SHORT" &&
    (post.mediaTypes?.some((t) => t === "video") ?? false)
  );
}
