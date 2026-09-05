# Third-party components

## citeproc-js / citeproc 2.4.63

Copyright (c) 2009–2019 Frank Bennett. The unmodified dependency is bundled into `main.js`; its source and original license notice are included in development packages under `third-party/citeproc/`.

- [Project and source](https://github.com/Juris-M/citeproc-js)
- [Processor API documentation](https://citeproc-js.readthedocs.io/en/latest/running.html)
- The distributed source license notice offers CPAL or AGPL; retain the original notice with redistributions. See `third-party/citeproc/LICENSE`.

## Citation Style Language styles and locales

The three styles and two locale files in `src/csl/` are unmodified files from the Citation Style Language repositories. Each retains its authors, contributors and CC BY-SA 3.0 notice. Copies are embedded in the executable bundle and included with source information in development packages.

- [Styles repository](https://github.com/citation-style-language/styles)
- [Locales repository](https://github.com/citation-style-language/locales)
- [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- Exact downloaded contents are identified by SHA-256 in `src/csl/sources.json` (retrieved 2026-09-05; repository URLs reference master, hashes pin the local snapshot).

Styles: APA Style 7th edition; China National Standard GB/T 7714-2015 (numeric, 中文); Chicago Manual of Style 18th edition (author-date). Locales: en-US and zh-CN.
