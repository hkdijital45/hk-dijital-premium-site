import { Stack } from "expo-router";
import { colors } from "../../../lib/theme";

export default function CustomersLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg }
      }}
    >
      <Stack.Screen name="index" options={{ title: "Müşteriler" }} />
      <Stack.Screen name="[id]" options={{ title: "Müşteri Detayı" }} />
    </Stack>
  );
}
