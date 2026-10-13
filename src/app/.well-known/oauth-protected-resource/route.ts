import { corsPreflight, metadataResponse, protectedResourceMetadata } from "@/lib/mcp/metadata";

export function GET() {
  return metadataResponse(protectedResourceMetadata());
}

export const OPTIONS = corsPreflight;
