import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch, ApiError } from "../../../lib/api";
import { Badge, Card, ErrorState, LoadingState } from "../../../components/ui";
import { spacing, typography, colors } from "../../../lib/theme";

type Company = { id: string; name: string; sector: string | null; city: string | null; website: string | null; lifecycle_stage: string | null; created_at: string };
type Integrations = { metaAds: string; googleAds: string; instagram: string; facebook: string } | null;

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [integrations, setIntegrations] = useState<Integrations>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const body = await apiFetch<{ company: Company; integrations: Integrations }>(`/api/mobile/customers/${id}`, token);
      setCompany(body.company);
      setIntegrations(body.integrations);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Müşteri bilgisi yüklenemedi.");
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!company) return <LoadingState label="Yükleniyor..." />;

  const connected = (status?: string) => status === "CONNECTED";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Card>
          <Text style={typography.title}>{company.name}</Text>
          <Text style={[typography.body, { marginTop: spacing.xs }]}>
            {[company.sector, company.city].filter(Boolean).join(" · ") || "Sektör/konum bilgisi yok"}
          </Text>
          {company.website ? <Text style={[typography.body, { marginTop: 2 }]}>{company.website}</Text> : null}
          <View style={{ marginTop: spacing.md }}>
            <Badge label={company.lifecycle_stage || "Durum bilgisi yok"} tone={company.lifecycle_stage === "Aktif Müşteri" ? "success" : "muted"} />
          </View>
        </Card>

        <Card>
          <Text style={typography.heading}>Entegrasyon Durumu</Text>
          {integrations ? (
            <View style={{ marginTop: spacing.sm, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Badge label={connected(integrations.metaAds) ? "Meta Ads Bağlı" : "Meta Ads Bağlı Değil"} tone={connected(integrations.metaAds) ? "accent" : "muted"} />
              <Badge label={connected(integrations.googleAds) ? "Google Ads Bağlı" : "Google Ads Bağlı Değil"} tone={connected(integrations.googleAds) ? "accent" : "muted"} />
              <Badge label={connected(integrations.instagram) ? "Instagram Bağlı" : "Instagram Bağlı Değil"} tone={connected(integrations.instagram) ? "orange" : "muted"} />
            </View>
          ) : (
            <Text style={[typography.body, { marginTop: spacing.sm }]}>Entegrasyon verisi şu anda kullanılamıyor.</Text>
          )}
        </Card>

        <Pressable onPress={() => router.push("/(tabs)/advertising")}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Ionicons name="megaphone-outline" size={20} color={colors.accent} />
            <Text style={[typography.heading, { flex: 1 }]}>Reklam Bağlantı Durumunu Gör</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
