"use client";

import { useCallback, useEffect, useState } from "react";

const ID_KEY = "champagne.user_id";
const NAME_KEY = "champagne.display_name";

export type Identity = { userId: string; displayName: string };

function readIdentity(): Identity | null {
  try {
    const userId = localStorage.getItem(ID_KEY);
    const displayName = localStorage.getItem(NAME_KEY);
    if (!userId || !displayName) return null;
    return { userId, displayName };
  } catch {
    return null;
  }
}

export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIdentity(readIdentity());
    setReady(true);
  }, []);

  const signIn = useCallback((rawName: string) => {
    const displayName = rawName.trim();
    if (!displayName) return;

    let userId: string;
    try {
      userId = localStorage.getItem(ID_KEY) || crypto.randomUUID();
      localStorage.setItem(ID_KEY, userId);
      localStorage.setItem(NAME_KEY, displayName);
    } catch {
      userId = crypto.randomUUID();
    }
    setIdentity({ userId, displayName });
  }, []);

  return { identity, ready, signIn };
}
