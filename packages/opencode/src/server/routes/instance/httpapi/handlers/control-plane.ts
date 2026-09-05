import { MoveSession } from "@opencode-ai/core/control-plane/move-session"
import { SessionV2 } from "@opencode-ai/core/session"
import { InstanceStore } from "@/project/instance-store"
import { Session } from "@/session/session"
import { SessionRunState } from "@/session/run-state"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RootHttpApi } from "../api"
import { ApiMoveSessionError, MoveSessionPayload } from "../groups/control-plane"

export const controlPlaneHandlers = HttpApiBuilder.group(RootHttpApi, "controlPlane", (handlers) =>
  Effect.gen(function* () {
    const service = yield* MoveSession.Service
    const sessions = yield* SessionV2.Service
    const instances = yield* InstanceStore.Service

    /**
     * A prompt driven over HTTP runs through SessionPrompt, whose runner state lives in the
     * instance of the session's directory rather than in any global service. So the guard has to
     * be asked there, in that instance, rather than inside MoveSession.
     */
    const assertIdle = Effect.fn("ControlPlaneHttpApi.assertIdle")(function* (sessionID: SessionV2.ID) {
      const current = yield* sessions.get(sessionID)
      yield* instances.provide(
        { directory: current.location.directory },
        SessionRunState.Service.use((state) => state.assertNotBusy(sessionID)),
      )
    })

    const moveSession = Effect.fn("ControlPlaneHttpApi.moveSession")(function* (ctx: {
      payload: typeof MoveSessionPayload.Type
    }) {
      yield* assertIdle(ctx.payload.sessionID).pipe(
        Effect.mapError(
          (error) =>
            new ApiMoveSessionError({
              name: "MoveSessionError",
              data: {
                message:
                  error instanceof Session.BusyError
                    ? "Session is busy. Wait for the current turn to finish before moving it."
                    : `Session not found: ${ctx.payload.sessionID}`,
              },
            }),
        ),
      )
      yield* service.moveSession(ctx.payload).pipe(
        Effect.mapError(
          (error) =>
            new ApiMoveSessionError({
              name: "MoveSessionError",
              data: { message: message(error) },
            }),
        ),
      )
    })

    return handlers.handle("moveSession", moveSession)
  }),
)

function message(error: MoveSession.Error) {
  if (error instanceof SessionV2.NotFoundError) return `Session not found: ${error.sessionID}`
  if (error instanceof MoveSession.SessionBusyError)
    return "Session is busy. Wait for the current turn to finish before moving it."
  if (error instanceof MoveSession.PendingRevertError)
    return "This session has a staged revert. Restore or keep those changes before moving it to another project."
  if (error instanceof MoveSession.DestinationProjectMismatchError)
    return "Destination directory belongs to another project"
  if (error instanceof MoveSession.ChangesAcrossProjectsError)
    return "Uncommitted changes cannot be carried into another project. Move without them, or commit them first."
  if (error instanceof MoveSession.ApplyChangesError)
    return `Unable to apply your changes in the destination directory. The files may conflict with existing changes.`
  return error.message
}
