import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearActiveWorkoutStatus,
  setActiveWorkoutStatus,
} from "../api/social";
import { Visibility } from "../types/social";

type Options = {
  sessionId?: string;
  templateId?: string;
  templateName?: string;
};

export const useActiveWorkoutStatus = ({
  sessionId,
  templateId,
  templateName,
}: Options) => {
  const [visibility, setVisibilityState] = useState<Visibility>("private");
  const lastSessionId = useRef<string | undefined>(sessionId);
  const hasInitialized = useRef(false);
  const lastTemplateName = useRef<string | undefined>(templateName);

  useEffect(() => {
    if (sessionId !== lastSessionId.current) {
      setVisibilityState("private");
      hasInitialized.current = false;
      lastSessionId.current = sessionId;
    }
  }, [sessionId]);

  const setStatusMutation = useMutation({
    mutationFn: setActiveWorkoutStatus,
  });

  const clearStatusMutation = useMutation({
    mutationFn: clearActiveWorkoutStatus,
  });

  useEffect(() => {
    if (!sessionId || hasInitialized.current) return;
    setStatusMutation.mutate({
      sessionId,
      templateId,
      templateName,
      visibility,
    });
    hasInitialized.current = true;
  }, [sessionId, templateId, templateName, visibility, setStatusMutation]);

  useEffect(() => {
    if (!sessionId || !hasInitialized.current) return;
    if (templateName && templateName !== lastTemplateName.current) {
      lastTemplateName.current = templateName;
      setStatusMutation.mutate({
        sessionId,
        templateId,
        templateName,
        visibility,
      });
    }
  }, [sessionId, templateId, templateName, setStatusMutation]);

  const setVisibility = useCallback(
    (next: Visibility) => {
      setVisibilityState(next);
      if (!sessionId) return;
      setStatusMutation.mutate({
        sessionId,
        templateId,
        templateName,
        visibility: next,
      });
    },
    [sessionId, templateId, templateName, setStatusMutation]
  );

  const endActiveStatus = useCallback(() => {
    if (!sessionId) return;
    clearStatusMutation.mutate(sessionId);
  }, [sessionId, clearStatusMutation]);

  const isUpdating = useMemo(
    () => setStatusMutation.isPending || clearStatusMutation.isPending,
    [setStatusMutation.isPending, clearStatusMutation.isPending]
  );

  useEffect(
    () => () => {
      if (sessionId) {
        clearStatusMutation.mutate(sessionId);
      }
    },
    [sessionId, clearStatusMutation]
  );

  return {
    visibility,
    setVisibility,
    endActiveStatus,
    isUpdating,
  };
};
