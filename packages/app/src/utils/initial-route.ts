import { createEffect, on } from "solid-js"

/**
 * Was the current route chosen by the user, or merely restored at startup?
 *
 * The desktop renderer writes the last active URL to local storage and sets it again on the next
 * launch, without checking whether its target still exists. A session that was deleted in the
 * meantime therefore greets the user with a "session not found" page they never asked for.
 *
 * A route the user actually picked is a different matter — there the message is correct. The only
 * difference between the two is whether anything has navigated since the window opened, which is
 * what this flag records. It is module scope on purpose: monotonic, not reactive, and unaffected
 * by how often a component re-runs.
 */
let navigated = false
let ignore = 0

export const markRouteNavigated = () => {
  navigated = true
}

/**
 * Announce a navigation the app performs on its own while still starting up — dropping a route
 * whose session no longer exists, for instance. It moves the user without them having chosen
 * anything, so it must not count as their first navigation; the startup handling that follows
 * would otherwise be skipped.
 */
export const markInternalNavigation = () => {
  ignore += 1
}

/** True until the user's first navigation, i.e. while startup handling still applies. */
export const isRestoredStartupRoute = () => !navigated

/** Call once below the router; `defer` skips the initial value so only real changes count. */
export function trackRouteNavigation(pathname: () => string) {
  createEffect(
    on(
      pathname,
      () => {
        if (ignore > 0) {
          ignore -= 1
          return
        }
        markRouteNavigated()
      },
      { defer: true },
    ),
  )
}
