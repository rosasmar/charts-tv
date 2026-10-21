import { Suspense } from "react";
import { RemoteUI } from "./remote-ui";

interface Props {
  params: Promise<{ code: string }>;
}

// This route depends on a dynamic URL param and has no static shell.
// `instant = false` opts it out of Cache Components static shell validation.
export const instant = false;

// Server component — unwraps params and passes code as a plain prop.
// Wrapped in <Suspense> so the param access streams instead of blocking prerender.
export default async function RemotePage({ params }: Props) {
  const { code } = await params;
  return (
    <Suspense>
      <RemoteUI code={code} />
    </Suspense>
  );
}
