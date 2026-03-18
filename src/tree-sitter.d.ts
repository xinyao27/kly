declare module "tree-sitter-typescript" {
  import type Parser from "tree-sitter";

  const mod: { typescript: Parser.Language; tsx: Parser.Language };
  export default mod;
}

declare module "tree-sitter-swift" {
  import type Parser from "tree-sitter";

  const lang: Parser.Language;
  export default lang;
}
