# Changelog

# [0.4.0](https://github.com/xinyao27/kly/compare/0.3.1...0.4.0) (2026-01-05)


### Features

* remove permissions ([5872cbf](https://github.com/xinyao27/kly/commit/5872cbf46c38386984d751cc1cbfc0d725309893))

## [0.3.1](https://github.com/xinyao27/kly/compare/0.3.0...0.3.1) (2026-01-04)

### Bug Fixes

- enhance link command to support remote references with caching validation and improved error handling ([6975016](https://github.com/xinyao27/kly/commit/6975016d470bb7818ce0c7a38a53df5dcc7b2740))

# [0.3.0](https://github.com/xinyao27/kly/compare/0.2.0...0.3.0) (2026-01-03)

### Features

- add commands for install, uninstall, link, and list to enhance CLI functionality; implement auto-registration of bin commands for local and remote projects ([4a94f20](https://github.com/xinyao27/kly/commit/4a94f20c159e25c20e90dbfe16a71d7c2a8557ce))

# [0.2.0](https://github.com/xinyao27/kly/compare/0.1.1...0.2.0) (2025-12-28)

### Bug Fixes

- improve package.json structure and enhance script execution context by setting working directory; update permissions management to clarify protected paths and enable pseudo-terminal support ([efdc9c2](https://github.com/xinyao27/kly/commit/efdc9c2f545e4e96ff758918982876caeb5b0a85))

### Features

- add invokeDir to execution context and update related interfaces to capture the working directory where kly run was invoked; enhance sandbox and remote execution handling for improved context management ([dd9a76c](https://github.com/xinyao27/kly/commit/dd9a76c4654ef3b6219ece1a63c06a54fcc0a48e))

## [0.1.1](https://github.com/xinyao27/kly/compare/0.1.0...0.1.1) (2025-12-28)

### Bug Fixes

- enhance permissions management by adding support for special filesystem path markers and improving permission extraction from remote apps; update sandbox configuration handling to utilize declared permissions effectively ([cf8dda5](https://github.com/xinyao27/kly/commit/cf8dda5774ffe31f91e1d4c38f0bca63b0ef2b98))

# 0.1.0 (2025-12-28)

### Features

- add architecture documentation detailing core design principles, app structure, and context-aware inference ([e3039f2](https://github.com/xinyao27/kly/commit/e3039f2a78bae03dc668fda3cf80bc9b13637595))
- add CLI tools for weather and greeting examples, enhance core functionality with tool and app definitions ([2c230f8](https://github.com/xinyao27/kly/commit/2c230f8c515d55feae06b633f3d0ccd982848a74))
- add project roadmap outlining phases, goals, and technical stack ([bb69228](https://github.com/xinyao27/kly/commit/bb69228d0df67e5577f66dcc94097d63303d9cf8))
- enhance AI integration by adding support for multiple LLM providers, including DeepSeek and Google; implement model configuration management in CLI for user-friendly model selection; update architecture documentation to reflect new AI capabilities and caching mechanisms ([0ca4c4d](https://github.com/xinyao27/kly/commit/0ca4c4d307b1725cd881b2f70b86b5ccf688ffce))
- enhance remote repository support with caching, fetching, and entry point resolution; update CLI to handle remote references and improve error handling ([6b5925f](https://github.com/xinyao27/kly/commit/6b5925f14f325926f1071ebbad856c9336214510))
- enhance table component with customizable formatting, alignment, and rendering options; add example for displaying user and statistics tables; implement name availability checker script for npm packages and domains ([62202e6](https://github.com/xinyao27/kly/commit/62202e6af5049528d400a48dae432cf773ddc71c))
- implement CLI runner with `clai` command, update architecture documentation to use @clack/prompts, and configure package for npm bin distribution ([f247f37](https://github.com/xinyao27/kly/commit/f247f37779155756eeca7fdf9d2626a5a2751c7c))
- implement integrity verification for remote repositories, including hash calculation and user trust prompts; add sum file management for tracking trusted code; enhance CLI with integrity checks before execution; update tests for new functionality ([b09adbd](https://github.com/xinyao27/kly/commit/b09adbd1012060afafb036f5635a4343b7130b12))
- implement MCP adapter for clai, enabling seamless integration with Claude Desktop; enhance examples for dual-mode support in CLI and MCP, and improve error handling for interactive components ([44b61ad](https://github.com/xinyao27/kly/commit/44b61adac244ea660421bda3d6a1af579243ebff))
- implement session management with save command and session summaries ([d4e79d9](https://github.com/xinyao27/kly/commit/d4e79d97b3ea3e6f063949233d9dfc9a906ba680))
- init ([f63424d](https://github.com/xinyao27/kly/commit/f63424d9526731934d7aa30e43777ddc4d01b8f4))
- introduce natural language processing capabilities in CLI, enabling users to input commands in plain language; add new travel advisor example and enhance existing tools with natural language support; update package.json with new dependencies for AI integration ([a77d106](https://github.com/xinyao27/kly/commit/a77d106fcb79501072459d8027260e3ae0e5d17b))
- introduce permissions management system with CLI support for listing, revoking, and clearing permissions; enhance sandbox execution with IPC communication for secure resource access; update examples to demonstrate new permissions features and improve code quality with new coding guidelines ([34f5def](https://github.com/xinyao27/kly/commit/34f5def3141e7c7e0d0afd765dc41ca3ebc39804))
- rename to kly ([40d8d60](https://github.com/xinyao27/kly/commit/40d8d60ba304a44f69e40998718b300ef60b5079))
- update dependencies and add new examples for autocomplete, multiselect, logging, password input, progress, and task management ([db4158b](https://github.com/xinyao27/kly/commit/db4158b74f2797e2a3cdb245c54d6801a6fec350))
- use @clack/prompts ([e16c0c5](https://github.com/xinyao27/kly/commit/e16c0c5e1293300646682d174be4fbb67e65ce02))
