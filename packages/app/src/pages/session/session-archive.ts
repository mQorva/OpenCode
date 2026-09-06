import { useNavigate } from "@solidjs/router"
import { useSDK } from "@/context/sdk"
import { useSessionKey } from "@/pages/session/session-layout"
import { legacySessionHref, requireServerKey, sessionHref } from "@/utils/session-route"

export function useSessionArchive() {
  const navigate = useNavigate()
  const sdk = useSDK()
  const { params } = useSessionKey()

  const navigateAfterRemoval = (sessionID: string, parentID?: string, nextSessionID?: string) => {
    if (params.id !== sessionID) return
    const href = (id: string) =>
      params.serverKey ? sessionHref(requireServerKey(params.serverKey), id) : legacySessionHref(sdk().directory, id)
    if (parentID) {
      navigate(href(parentID))
      return
    }
    if (nextSessionID) {
      navigate(href(nextSessionID))
      return
    }
    // Nothing left to fall back to in this directory. Landing on the root lets the layout decide
    // what to show; opening a chat of its own would put it in a directory nobody picked.
    if (params.serverKey) {
      navigate("/")
      return
    }
    navigate(`/${params.dir}/session`)
  }

  return { navigateAfterRemoval }
}
