import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClassName =
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn(fieldClassName, "h-10", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClassName, "min-h-20 py-2", className)} {...props} />;
}

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(fieldClassName, "h-10 bg-background", className)} {...props} />;
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}

export { Field, Input, Label, Select, Textarea };
