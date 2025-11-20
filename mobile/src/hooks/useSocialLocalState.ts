import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

type SocialState = {
  squads: { name: string; members: string[] }[];
};

const STORAGE_KEY = "push-pull.social-state";

const defaultState: SocialState = {
  squads: [],
};

export const useSocialLocalState = () => {
  const [state, setState] = useState<SocialState>(defaultState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setState(JSON.parse(raw) as SocialState);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const persist = async (next: SocialState) => {
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const createSquad = async (name: string) => {
    if (!name.trim()) return;
    if (state.squads.find((s) => s.name === name.trim())) return;
    await persist({ ...state, squads: [...state.squads, { name: name.trim(), members: [] }] });
  };

  const inviteToSquad = async (squadName: string, handle: string) => {
    const normalized = handle.startsWith("@") ? handle : `@${handle}`;
    const squads = state.squads.map((squad) =>
      squad.name === squadName
        ? { ...squad, members: Array.from(new Set([...squad.members, normalized])) }
        : squad
    );
    await persist({ ...state, squads });
  };

  return {
    state,
    loading,
    createSquad,
    inviteToSquad,
  };
};
