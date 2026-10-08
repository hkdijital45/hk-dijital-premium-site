import { Redirect } from "expo-router";
import { View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { LoadingState } from "../components/ui";
import { colors } from "../lib/theme";

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <LoadingState label="Oturum kontrol ediliyor..." />
      </View>
    );
  }

  return <Redirect href={token ? "/(tabs)" : "/login"} />;
}
