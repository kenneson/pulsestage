import { MotionProvider } from "@/components/motion/motion-provider";

// Celular da plateia e telão: as telas que mais se mexem (pergunta que chega, resultados, ranking).
export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}
