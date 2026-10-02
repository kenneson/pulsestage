import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={16}
      height={16}
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Icon>;
export const ArrowUpIcon = (p: IconProps) => <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>;
export const ArrowDownIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M19 12l-7 7-7-7" /></Icon>;
export const PlayIcon = (p: IconProps) => <Icon {...p}><path d="M6 4l14 8-14 8z" /></Icon>;
export const PauseIcon = (p: IconProps) => <Icon {...p}><path d="M8 5v14M16 5v14" /></Icon>;
export const StopIcon = (p: IconProps) => <Icon {...p}><rect x="6" y="6" width="12" height="12" rx="1" /></Icon>;
export const NextIcon = (p: IconProps) => <Icon {...p}><path d="M5 4l10 8-10 8zM19 5v14" /></Icon>;
export const ExternalIcon = (p: IconProps) => <Icon {...p}><path d="M15 3h6v6M10 14L21 3M21 14v7H3V3h7" /></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M20 6L9 17l-5-5" /></Icon>;
export const UsersIcon = (p: IconProps) => <Icon {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21v-1a6 6 0 0 1 12 0v1M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6" /></Icon>;
export const SparklesIcon = (p: IconProps) => <Icon {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z" /></Icon>;
export const EditIcon = (p: IconProps) => <Icon {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Icon>;
export const EyeIcon = (p: IconProps) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>;
