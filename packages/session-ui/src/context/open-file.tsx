import { createContext, useContext, type ParentProps } from "solid-js"

export type OpenFilePath = (path: string) => void

const context = createContext<OpenFilePath>()

/**
 * Optional bridge for chat-rendered file paths (assistant markdown inline code,
 * user @-references) to open the file in a host-defined surface such as the
 * session side panel. Without a provider, paths render exactly as before.
 */
export function OpenFileProvider(props: ParentProps<{ open: OpenFilePath }>) {
  return <context.Provider value={props.open}>{props.children}</context.Provider>
}

export const useOpenFile = () => useContext(context)
