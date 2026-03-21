# TASTE

## Azure deployment should remain optional in local/dev workflows

- Preference:
  Treat `AZURE_OPENAI_DEPLOYMENT` as optional. If missing, fall back to the model name (`OPENAI_MODEL`, default `gpt-5-mini`).
- Decision rule:
  Env validation must require `AZURE_OPENAI_ENDPOINT` when Azure key is set, but must not hard-fail on missing `AZURE_OPENAI_DEPLOYMENT`.
