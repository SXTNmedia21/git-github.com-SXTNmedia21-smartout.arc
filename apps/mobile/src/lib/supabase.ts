/**
 * Supabase client configured for React Native + Web.
 * Native: uses expo-secure-store for encrypted token persistence.
 * Web: uses localStorage (standard browser storage).
 * detectSessionInUrl: enabled on web (magic link redirects), disabled on native (OTP only).
 */
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import type { Database } from "@smartout/supabase/database.types";

// Web uses localStorage, native uses SecureStore
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
        setItem: (key: string, value: string) => {
          localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          localStorage.removeItem(key);
          return Promise.resolve();
        },
      }
    : (() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
        return {
          getItem: (key: string) => SecureStore.getItemAsync(key),
          setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
          removeItem: (key: string) => SecureStore.deleteItemAsync(key),
        };
      })();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
