'use client';
import { useEffect, useRef } from 'react';

export default function RawPage({ markup, script }: { markup: string; script: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = markup;
    const s = document.createElement('script');
    s.textContent = script;
    document.body.appendChild(s);
    return () => {
      s.remove();
      host.innerHTML = '';
    };
  }, [markup, script]);
  return <div ref={ref} />;
}
