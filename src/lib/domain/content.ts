// Slide de conteúdo: texto em blocos e vídeo do YouTube/Vimeo. Regras puras (sem I/O).

/**
 * Endereço do player embutido a partir de um link do YouTube ou do Vimeo; null para qualquer outro site
 * (só esses dois entram no telão, em iframe sem cookies de rastreio quando o serviço oferece).
 */
export function toEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const id = /^[A-Za-z0-9_-]{6,20}$/;

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const fromQuery = url.searchParams.get("v");
    const fromPath = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1];
    const video = fromQuery ?? fromPath;
    return video && id.test(video) ? `https://www.youtube-nocookie.com/embed/${video}` : null;
  }
  if (host === "youtu.be") {
    const video = url.pathname.slice(1).split("/")[0];
    return video && id.test(video) ? `https://www.youtube-nocookie.com/embed/${video}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const video = url.pathname.match(/(?:^|\/)(\d{5,12})(?:$|\/)/)?.[1];
    return video ? `https://player.vimeo.com/video/${video}?dnt=1` : null;
  }
  return null;
}

export type ContentBlock = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

/**
 * Texto do slide em blocos: linhas em branco separam parágrafos; linhas que começam com "- " ou "• "
 * viram itens de lista. Sem HTML: o texto é renderizado como texto.
 */
export function contentBlocks(body: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    let paragraph: string[] = [];
    let list: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ kind: "list", items: list });
      list = [];
    };
    for (const line of lines) {
      const item = line.match(/^[-•*]\s+(.*)$/)?.[1];
      if (item !== undefined) {
        flushParagraph();
        list.push(item);
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}
