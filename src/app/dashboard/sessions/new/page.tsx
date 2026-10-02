import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionForm } from "@/components/sessions/session-form";

export const metadata: Metadata = { title: "Nova sessão" };

export default function NewSessionPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Nova sessão</CardTitle>
          <CardDescription>Uma palestra, aula, workshop ou treinamento. Depois você adiciona as interações.</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionForm />
        </CardContent>
      </Card>
    </div>
  );
}
