"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@/components/icons";

const QR_SIZE = 1024;
const FOOTER = 240;

/** Baixar o QR Code de entrada em PNG (fundo branco, código e endereço embaixo). `canvas` precisa estar na página. */
export function useQrDownload(joinUrl: string, code: string) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  function download() {
    const qr = qrRef.current;
    if (!qr) return;
    const out = document.createElement("canvas");
    out.width = QR_SIZE;
    out.height = QR_SIZE + FOOTER;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    // Fundo branco sempre: QR em fundo escuro falha na leitura de muitos celulares.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(qr, 0, 0, QR_SIZE, QR_SIZE);
    ctx.textAlign = "center";
    ctx.fillStyle = "#111111";
    ctx.font = "800 104px 'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(code, QR_SIZE / 2, QR_SIZE + 105, QR_SIZE - 80);
    ctx.fillStyle = "#444444";
    ctx.font = "40px Arial, sans-serif";
    ctx.fillText(joinUrl.replace(/^https?:\/\//, ""), QR_SIZE / 2, QR_SIZE + 185, QR_SIZE - 80);

    const link = document.createElement("a");
    link.href = out.toDataURL("image/png");
    link.download = `pulsestage-qr-${code}.png`;
    link.click();
  }

  const canvas = <QRCodeCanvas ref={qrRef} value={joinUrl || " "} size={QR_SIZE} marginSize={4} className="hidden" aria-hidden />;
  return { download, canvas };
}

export function QrDownloadButton({ joinUrl, code, className }: { joinUrl: string; code: string; className?: string }) {
  const t = useTranslations("session.qr");
  const { download, canvas } = useQrDownload(joinUrl, code);
  return (
    <>
      {canvas}
      <Button variant="outline" size="sm" className={className} onClick={download}>
        <DownloadIcon /> {t("download")}
      </Button>
    </>
  );
}
