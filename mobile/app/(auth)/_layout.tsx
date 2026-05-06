import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
