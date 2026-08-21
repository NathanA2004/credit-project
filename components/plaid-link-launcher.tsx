"use client";

import { useEffect } from "react";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";

export function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken, metadata) => {
      if (!publicToken) {
        onExit();
        return;
      }
      onSuccess(publicToken, metadata);
    },
    onExit: () => onExit(),
  });

  useEffect(() => {
    if (ready) open();
  }, [open, ready]);

  return null;
}
