import { expect, test } from "bun:test"
import { MQORVA_APP_IDS, MQORVA_UNPACKAGED_APP_ID } from "./identity"

test("keeps the unpackaged desktop identity separate from installed channels", () => {
  expect(Object.values(MQORVA_APP_IDS)).not.toContain(MQORVA_UNPACKAGED_APP_ID)
})
