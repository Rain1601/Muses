declare module 'turndown' {
  interface Options {
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    bulletListMarker?: '-' | '+' | '*';
    codeBlockStyle?: 'indented' | 'fenced';
    emDelimiter?: '_' | '*';
    strongDelimiter?: '__' | '**';
    linkStyle?: 'inlined' | 'referenced';
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
  }

  class TurndownService {
    constructor(options?: Options);
    turndown(html: string): string;
    addRule(key: string, rule: any): this;
    use(plugins: any | any[]): this;
    remove(filter: string | string[] | ((node: HTMLElement) => boolean)): this;
  }

  export default TurndownService;
}
