/** Inline new-session content width — keep in sync with session composer `placement === "inline"`. */
export const NEW_SESSION_CONTENT_WIDTH = "w-full max-w-200 2xl:max-w-[1000px] px-0"

/**
 * Sidebar-layout width for the new-session composer and wordmark. The running session's dock puts
 * its padding on the same element as the max width, so the 800px cap includes it and the composer
 * comes out 24px narrower than the cap. Carrying the padding here rather than on the parent is
 * what keeps a draft and a running session the same width — otherwise sending the first message
 * visibly resizes the input.
 */
export const NEW_SESSION_SIDEBAR_CONTENT_WIDTH = "w-full px-3 max-w-200 2xl:max-w-[1000px]"
