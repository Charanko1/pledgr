import type { ReactNode } from "react";
export default function PageHeading({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="pledgr-eyebrow">{eyebrow}</p><h1 className="pledgr-title">{title}</h1><p className="mt-3 text-muted max-w-2xl">{description}</p></div>{aside}</div>;
}
