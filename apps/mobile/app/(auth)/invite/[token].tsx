/**
 * Deep link handler for invite tokens.
 * URL: app.smartout.ai/invite/[token] or smartout://invite/[token]
 * Validates the token against the invitation table, shows the workspace,
 * and redirects to verify screen with invite context on confirmation.
 */
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useTheme, withOpacity } from "@/theme";

type InviteData = {
  workspaceId: string;
  workspaceName: string;
  logoUrl: string | null;
  token: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

export default function InviteDeepLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Ingen invitasjonskode funnet i lenken.");
      setIsLoading(false);
      return;
    }

    void validateToken(token);
  }, [token]);

  async function validateToken(tokenValue: string) {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("invitation")
      .select(
        "invitation_id, token, status, first_name, last_name, email, phone, workspace:workspace_id(workspace_id, name, logo_url)",
      )
      .eq("token", tokenValue)
      .eq("status", "pending")
      .single();

    setIsLoading(false);

    if (fetchError || !data) {
      setError("Denne invitasjonen er ugyldig eller har utlopt.");
      return;
    }

    const ws = data.workspace as unknown as {
      workspace_id: string;
      name: string;
      logo_url: string | null;
    } | null;

    if (!ws) {
      setError("Fant ikke arbeidsplassen knyttet til denne invitasjonen.");
      return;
    }

    setInvite({
      workspaceId: ws.workspace_id,
      workspaceName: ws.name,
      logoUrl: ws.logo_url,
      token: tokenValue,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
    });
  }

  function handleConfirm() {
    if (!invite) return;
    router.push({
      pathname: "/(auth)/invite/confirm",
      params: {
        workspaceId: invite.workspaceId,
        workspaceName: invite.workspaceName,
        token: invite.token,
        firstName: invite.firstName ?? "",
        lastName: invite.lastName ?? "",
        email: invite.email ?? "",
        phone: invite.phone ?? "",
      },
    });
  }

  function handleGoToWelcome() {
    router.replace("/(auth)/welcome");
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color={colors.brandOrange} />
        <Text style={{ fontSize: 15, color: colors.mutedForeground, marginTop: 16 }}>
          Sjekker invitasjonen...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: 24,
        }}
      >
        <Text
          style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}
        >
          Noe gikk galt
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 15,
            textAlign: "center",
            marginBottom: 24,
            paddingHorizontal: 16,
          }}
        >
          {error}
        </Text>
        <TouchableOpacity
          style={{
            width: "100%",
            height: 52,
            backgroundColor: colors.brandOrange,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={handleGoToWelcome}
        >
          <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>
            Ga til innlogging
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!invite) return null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 24,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        {invite.logoUrl ? (
          <Image
            source={{ uri: invite.logoUrl }}
            style={{ width: 88, height: 88, borderRadius: 18, marginBottom: 20 }}
          />
        ) : (
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 18,
              backgroundColor: withOpacity(colors.brandOrange, 0.08),
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 36, fontWeight: "700", color: colors.brandOrange }}>
              {invite.workspaceName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Text
          style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, textAlign: "center" }}
        >
          Bli med i
        </Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: colors.brandOrange,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {invite.workspaceName}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: colors.mutedForeground,
            textAlign: "center",
            marginTop: 12,
            paddingHorizontal: 16,
            lineHeight: 22,
          }}
        >
          Du er invitert til denne arbeidsplassen. Bekreft for a komme i gang.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <TouchableOpacity
          style={{
            width: "100%",
            height: 52,
            backgroundColor: colors.brandOrange,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={handleConfirm}
        >
          <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>
            Bekreft og fortsett
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ width: "100%", height: 48, alignItems: "center", justifyContent: "center" }}
          onPress={handleGoToWelcome}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Avbryt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
