import { useReflexStore } from "@/store/reflex-store";

export function ActionToast() {
  const notice = useReflexStore((s) => s.notice);
  const clearNotice = useReflexStore((s) => s.clearNotice);
  if (!notice) return null;

  return (
    <button
      type="button"
      onClick={clearNotice}
      className="reflex-toast"
      data-first-sight-word
      aria-live="polite"
    >
      <span className="reflex-toast__dot" aria-hidden />
      <span>{notice.text}</span>
    </button>
  );
}
