import { useCallback, useState } from "react";
import { FlatList, Linking, Modal, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { apiFetch, ApiError, API_BASE_URL } from "../../lib/api";
import { Card, EmptyState, ErrorState, LoadingState, ScreenTitle } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../lib/theme";

type FavoriteModule = { slug: string; label: string; description: string };

// Real, server-backed, cross-device favorites — same
// public.admin_user_preferences row the web admin's Favoriler button
// reads/writes (/api/mobile/favorites -> /api/admin/preferences' table).
// A module that has no native screen yet opens the live web admin in the
// system browser (not a WebView) instead of faking a feature.
const NATIVE_ROUTES: Record<string, string> = {
  dashboard: "/(tabs)",
  musteriler: "/(tabs)/customers",
  "ad-insights": "/(tabs)/advertising",
  gorevler: "/(tabs)/tasks"
};

export default function FavoritesScreen() {
  const { token } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteModule[] | null>(null);
  const [allModules, setAllModules] = useState<FavoriteModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const body = await apiFetch<{ favorites: FavoriteModule[] }>("/api/mobile/favorites", token);
      setFavorites(body.favorites);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Favoriler yüklenemedi.");
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function openPicker() {
    setPickerOpen(true);
    if (!token || allModules) return;
    try {
      const body = await apiFetch<{ modules: FavoriteModule[] }>("/api/mobile/favorites/modules", token);
      setAllModules(body.modules);
    } catch {
      setAllModules([]);
    }
  }

  async function toggleFavorite(slug: string) {
    if (!token || saving) return;
    const current = favorites || [];
    const isFavorite = current.some((item) => item.slug === slug);
    const nextSlugs = isFavorite ? current.filter((item) => item.slug !== slug).map((item) => item.slug) : [...current.map((item) => item.slug), slug];
    setSaving(true);
    try {
      const body = await apiFetch<{ favorites: FavoriteModule[] }>("/api/mobile/favorites", token, {
        method: "PATCH",
        body: JSON.stringify({ favorites: nextSlugs })
      });
      setFavorites(body.favorites);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Favoriler güncellenemedi.");
    } finally {
      setSaving(false);
    }
  }

  function openModule(slug: string) {
    const nativeRoute = NATIVE_ROUTES[slug];
    if (nativeRoute) {
      router.push(nativeRoute as never);
      return;
    }
    Linking.openURL(`${API_BASE_URL}/hk-admin/${slug}`);
  }

  const favoriteSlugs = new Set((favorites || []).map((item) => item.slug));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <ScreenTitle title="Favoriler" subtitle="Sık kullandığınız modüllere hızlı erişim" />
        <Pressable onPress={openPicker} style={{ marginBottom: spacing.lg }}>
          <Ionicons name="add-circle" size={30} color={colors.accent} />
        </Pressable>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !favorites ? (
        <LoadingState label="Favoriler yükleniyor..." />
      ) : favorites.length === 0 ? (
        <EmptyState title="Henüz favori yok" description="Sağ üstteki + simgesinden modül ekleyin." />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.slug}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable onPress={() => openModule(item.slug)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.heading}>{item.label}</Text>
                  {item.description ? <Text style={[typography.body, { marginTop: 2 }]}>{item.description}</Text> : null}
                  {!NATIVE_ROUTES[item.slug] ? <Text style={[typography.caption, { marginTop: spacing.xs }]}>Web&apos;de açılır</Text> : null}
                </View>
                <Pressable onPress={() => toggleFavorite(item.slug)} hitSlop={10}>
                  <Ionicons name="star" size={22} color={colors.orange} />
                </Pressable>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setPickerOpen(false)} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: "75%", borderTopWidth: 1, borderColor: colors.border }}>
          <View style={{ padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={typography.heading}>Modül Ekle</Text>
          </View>
          {!allModules ? (
            <LoadingState label="Modüller yükleniyor..." />
          ) : (
            <FlatList
              data={allModules}
              keyExtractor={(item) => item.slug}
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
              renderItem={({ item }) => {
                const active = favoriteSlugs.has(item.slug);
                return (
                  <Pressable onPress={() => toggleFavorite(item.slug)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
                    <Ionicons name={active ? "star" : "star-outline"} size={20} color={active ? colors.orange : colors.textMuted} />
                    <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{item.label}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
