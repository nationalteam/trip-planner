# TASTE

## Azure deployment should remain optional in local/dev workflows

- Preference:
  Treat `AZURE_OPENAI_DEPLOYMENT` as optional. If missing, fall back to the model name (`OPENAI_MODEL`, default `gpt-5-mini`).
- Decision rule:
  Env validation must require `AZURE_OPENAI_ENDPOINT` when Azure key is set, but must not hard-fail on missing `AZURE_OPENAI_DEPLOYMENT`.

## Use a single model variable for all non-Azure providers

- Preference:
  Do not use `BIFROST_MODEL`; use `OPENAI_MODEL` for Bifrost model selection as well.
- Decision rule:
  For `openai` and `bifrost` providers, read only `OPENAI_MODEL` (default `gpt-5-mini`) as the model override.
