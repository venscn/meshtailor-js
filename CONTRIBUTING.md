[**English**](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

# Contributing

Issues, pull requests, and documentation improvements are welcome in English or Chinese.

## Local development

Use Node.js 22.16+ and npm:

```bash
npm ci
npm run dev
```

`apps/studio` contains the React/Vite interface, `apps/unfold-lab` the offline workbench source, and `apps/cli` the OBJ CLI. `packages/mesh-core` handles geometry and topology; `packages/uv` handles unfolding, packing, and postprocessing. Other packages provide seam chains, runtime support, and research backend interfaces.

## Verify before submitting

```bash
npm run check:geometry
npm run check
npm run test:git
```

Choose additional checks for the behavior changed. A generation-strategy change must test both real fixtures with original / absent / randomized UVs and compare every actual seam and face-corner coordinate:

```bash
npm run test:geometry:real
```

After changing offline workbench source or production modules, rebuild `unfold-lab.html` with `npm run lab:build`. Browser suites require Chrome / Chromium / Edge; configure `CHROME_PATH` if needed. For example, run `npm run test:geometry:browser`. Report environment limits and distinguish offline tests from full Studio browser tests.

Legacy `source-atlas` / source-island scripts are historical experiments, not acceptance tests for the current generator. Preserve their assertions and history.

## Report issues and propose changes

Include reproduction steps, expected and actual behavior, application version, browser / Node.js version, relevant settings, and a minimal model. Repository fixtures need a source and license that permits redistribution.

Keep changes focused. Preserve existing commits and tags, make small commits for independent changes with necessary regression coverage, and do not overwrite another contributor's uncommitted work. See [AGENTS.md](AGENTS.md) and the [Git workflow](docs/GIT_WORKFLOW.md).

Update [asset provenance](THIRD_PARTY_ASSETS.md) when adding assets. Keep pinned fixture checksums; a same-name download must not replace an existing real model.

## Documentation and licensing

English is the default for maintained public entry documents. Keep the corresponding `.zh-CN.md` file, language links, commands, limitations, and license scope in sync. Historical reports remain in their original language; label any English summary clearly.

Contributions to project-owned code and documentation are made under the project's [MIT License](LICENSE). Third-party assets and dependencies retain their own licenses; see the [licensing guide](docs/LICENSING.md). There is no separate CLA or DCO requirement in this repository.
