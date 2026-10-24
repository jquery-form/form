# Dual publish: classic `$.fn` and modern module

jQuery Form is consumed as a classic jQuery plugin (script tag, AMD, `$.fn`) and must keep working that way even as the repo modernizes. We publish **both** a modern module entry and a classic browser/`$.fn` build (UMD or equivalent). ESM-only was rejected: it would break the long tail of existing integrations. Agents and packaging changes preserve both surfaces.
