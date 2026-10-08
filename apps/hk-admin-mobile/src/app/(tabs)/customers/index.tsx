import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch, ApiError } from "../../../lib/api";
import { Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { colors, radius, spacing, typography } from "../../../lib/theme";

type Company = { id: string; name: string; sector: string | null; city: string | null; lifecycle_stage: string | null };

export default function CustomersScreen() {
  const { token } = useAuth();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(
    async (query?: string) => {
      if (!token) return;
      setError(null);
      try {
        const qs = query ? `?q=${encodeURIComponent(query)}` : "";
        const body = await apiFetch<{ companies: Company[] }>(`/api/mobile/customers${qs}`, token);
        setCompanies(body.companies);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Müşteriler yüklenemedi.");
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      load(search);
    }, [load]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <TextInput
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            load(value);
          }}
          placeholder="Müşteri ara..."
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.textPrimary
          }}
        />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={() => load(search)} />
      ) : !companies ? (
        <LoadingState label="Müşteriler yükleniyor..." />
      ) : companies.length === 0 ? (
        <EmptyState title="Müşteri bulunamadı" description="Arama kriterlerinize uyan bir müşteri yok." />
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/(tabs)/customers/${item.id}`)}>
              <Card>
                <Text style={typography.heading}>{item.name}</Text>
                <Text style={[typography.body, { marginTop: 4 }]}>
                  {[item.sector, item.city].filter(Boolean).join(" · ") || "Detay yok"}
                </Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
