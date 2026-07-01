'use client';

import { useState } from 'react';
import { deleteProject } from './actions';

export default function DeleteProjectButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    if (!confirm('Delete this project and all its links?')) return;
    setPending(true);
    await deleteProject(id);
  }

  return (
    <button
      className="btn-danger"
      onClick={handleClick}
      disabled={pending}
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      {pending ? '…' : 'Delete'}
    </button>
  );
}
