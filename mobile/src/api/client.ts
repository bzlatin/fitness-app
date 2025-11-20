import axios from "axios";
import Constants from "expo-constants";

const DEFAULT_API_URL = "http://localhost:4000/api";

const resolveApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // When running through Expo Go on a device, re-use the Metro host IP so requests reach the dev machine.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host) {
      return `http://${host}:4000/api`;
    }
  }

  return DEFAULT_API_URL;
};

export const API_BASE_URL = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});
