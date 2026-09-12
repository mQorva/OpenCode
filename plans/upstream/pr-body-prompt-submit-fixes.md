### Issue for this PR

Closes #48528
Closes #48529

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Two small fixes in the app's prompt submission path.

**Recover text when the store is empty but the DOM editor still holds it** (Closes #48528). `createPromptSubmit` parsed the prompt from the store-backed state only. When that state is empty but the DOM editor element still contains text (e.g. after a navigation or state reset), the submit saw an empty prompt and returned early, silently discarding the typed message. The fix falls back to parsing the DOM editor element via a new `parsePromptInputV2Editor` helper when the store is empty and no images or comments are present, and sends the recovered text.

**Send v1 follow-up prompts to their session directory** (Closes #48529). The V1 compat API's `prompt` path always used the directory the client was created with (the project directory), ignoring the session's own directory. The app now passes `sessionDirectory` when sending a follow-up draft, and the compat layer routes the prompt to that directory instead.

### How did you verify your code works?

- `bun typecheck` (tsgo) passes in `packages/app` and `packages/session-ui`.
- `submit.test.ts` passes 9/9, including a new regression test that submits recovered text from a DOM editor element when the store is empty.
- `git diff --check` clean; no unrelated changes.

### Screenshots / recordings

n/a (non-UI behaviour; recovery happens before the prompt is sent)

### Fork

- Source fork: https://github.com/mQorva/OpenCode
- Diff against this fork's dev: https://github.com/mQorva/OpenCode/compare/dev...prompt-submit-fixes
- mQorva issue / context: n/a

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR
