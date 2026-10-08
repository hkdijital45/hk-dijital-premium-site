import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { colors } from "../../lib/theme";

export default function TabsLayout() {
  const { token, loading } = useAuth();

  if (!loading && !token) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 88, paddingBottom: 28, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Ana Sayfa", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="customers" options={{ title: "Müşteriler", tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }} />
      <Tabs.Screen name="advertising" options={{ title: "Reklamlar", tabBarIcon: ({ color, size }) => <Ionicons name="megaphone" color={color} size={size} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "Bildirimler", tabBarIcon: ({ color, size }) => <Ionicons name="notifications" color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: "Menü", tabBarIcon: ({ color, size }) => <Ionicons name="menu" color={color} size={size} /> }} />
    </Tabs>
  );
}
