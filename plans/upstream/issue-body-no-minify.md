Title:
Add --no-minify flag to the opencode CLI build script

Description:
`packages/opencode/script/build.ts` already accepts `--sourcemaps`, `--single`,
`--baseline`, `--skip-install`, `--skip-embed-web-ui`, but there is no way to
opt out of minification. When a regression only reproduces against the
unminified bundle (readable stack traces, exact symbol names, dev-only
breakage hidden by the minifier), the only current option is to edit
`build.ts` and revert before committing. A `--no-minify` sibling flag keeps the
default behaviour and gives contributors a one-shot escape hatch.

Plugins: n/a
OpenCode version: dev (dc4449df0d)

Steps to reproduce:
1. `cd packages/opencode && bun run script/build.ts --no-minify` is not a
   recognised flag; build still runs with `minify: true`.
2. Edit `build.ts` and change `minify: true` to `minify: false`; the next
   build uses the unminified bundle.

Expected behaviour:
- `bun run script/build.ts --no-minify` should produce a non-minified bundle
  without source edits.
- Default behaviour (no flag) should be unchanged: `minify: true` as before.

Actual behaviour:
- `--no-minify` is silently ignored today.

Operating System: n/a
Terminal: n/a

Related / duplicate check: no related upstream issue found.
