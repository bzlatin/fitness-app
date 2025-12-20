import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearActiveWorkoutStatus,
  setActiveWorkoutStatus,
} from "../api/social";
import { Visibility } from "../types/social";
import {
  getStoredLiveVisibility,
  setStoredLiveVisibility,
} from "../utils/liveVisibilityPreference";

type Options = {
  sessionId?: string;
  templateId?: string;
  templateName?: string;
  initialVisibility?: Visibility;
  autoClearOnUnmount?: boolean;
};

export const useActiveWorkoutStatus = ({
  sessionId,
  templateId,
  templateName,
  initialVisibility,
  autoClearOnUnmount = true,
}: Options) => {
  const [visibility, setVisibilityState] = useState<Visibility>(
    initialVisibility ?? "private"
  );
  const [visibilityResolved, setVisibilityResolved] = useState<boolean>(
    Boolean(initialVisibility)
  );
  const lastSessionId = useRef<string | undefined>(sessionId);
  const hasInitialized = useRef(false);
  const lastTemplateName = useRef<string | undefined>(templateName);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (initialVisibility) {
        setVisibilityState(initialVisibility);
        setVisibilityResolved(true);
        void setStoredLiveVisibility(initialVisibility);
        return;
      }

      const stored = await getStoredLiveVisibility();
      if (cancelled) return;
      setVisibilityState(stored ?? "private");
      setVisibilityResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialVisibility, sessionId]);

  useEffect(() => {
    if (sessionId !== lastSessionId.current) {
      if (initialVisibility) {
        setVisibilityState(initialVisibility);
      }
      setVisibilityResolved(Boolean(initialVisibility));
      hasInitialized.current = false;
      lastSessionId.current = sessionId;
    }
  }, [sessionId, initialVisibility]);

  const setStatusMutation = useMutation({
    mutationFn: setActiveWorkoutStatus,
  });

  const clearStatusMutation = useMutation({
    mutationFn: clearActiveWorkoutStatus,
  });
  const setStatus = setStatusMutation.mutate;
  const clearStatus = clearStatusMutation.mutate;

  useEffect(() => {
    if (!sessionId || hasInitialized.current || !visibilityResolved) return;
    setStatus({
      sessionId,
      templateId,
      templateName,
      visibility,
    });
    hasInitialized.current = true;
  }, [sessionId, templateId, templateName, visibility, setStatus]);

  useEffect(() => {
    if (!sessionId || !hasInitialized.current) return;
    if (templateName && templateName !== lastTemplateName.current) {
      lastTemplateName.current = templateName;
      setStatus({
        sessionId,
        templateId,
        templateName,
        visibility,
      });
    }
  }, [sessionId, templateId, templateName, setStatus, visibility]);

  const setVisibility = useCallback(
    (next: Visibility) => {
      setVisibilityState(next);
      setVisibilityResolved(true);
      void setStoredLiveVisibility(next);
      if (!sessionId) return;
      setStatus({
        sessionId,
        templateId,
        templateName,
        visibility: next,
      });
    },
    [sessionId, templateId, templateName, setStatus]
  );

  const endActiveStatus = useCallback(() => {
    if (!sessionId) return;
    clearStatus(sessionId);
  }, [sessionId, clearStatus]);

  const isUpdating = useMemo(
    () => setStatusMutation.isPending || clearStatusMutation.isPending,
    [setStatusMutation.isPending, clearStatusMutation.isPending]
  );

  useEffect(
    () => () => {
      if (autoClearOnUnmount && sessionId) {
        clearStatus(sessionId);
      }
    },
    [autoClearOnUnmount, sessionId, clearStatus]
  );

  return {
    visibility,
    setVisibility,
    endActiveStatus,
    isUpdating,
  };
};
