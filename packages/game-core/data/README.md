# WRDL Word Catalog

`word-catalog.csv` is WRDL's version-controlled source of truth for accepted guesses and answer eligibility.

## Provenance and licensing review

At the project owner's direction, the M3 catalog mirrors the two archived Wordle lists discussed during product review:

- **2,309 Common answer words:** the embedded CSV dataset exposed by [WordsLibrary's Wordle Dictionary page](https://wordslibrary.com/wordle-dictionary-words/).
- **10,657 Rare guess-only words:** the archived [`cfreshman/wordle-allowed-guesses`](https://gist.github.com/cfreshman/cdcdf777450c5b5301e439061d29694c) list referenced in the supplied research discussion.

The combined catalog contains exactly 12,966 unique five-letter words. These sources are publicly accessible archives, but neither page presents an explicit standalone dataset license. WRDL is currently a private, non-commercial personal project; source and count metadata are retained here so redistribution can be reassessed if that changes.

## Curation rules

- Exactly five lowercase ASCII letters per word.
- No WRDL-specific filtering or reclassification is applied.
- Every Common word is accepted as a guess and eligible for Daily Wordle and Free Play.
- Every Rare word is accepted as a guess and eligible for Rare Free Play, but not Daily Wordle.
- Common contains exactly 2,309 words; Rare contains exactly 10,657 words.
- Selecting Rare in Free Play expands the answer pool to all 12,966 accepted words.

Run `pnpm catalog:write` after editing the CSV, then run `pnpm catalog:check` to verify formats, duplicates, exact source counts, pool eligibility, and the generated TypeScript catalog.
