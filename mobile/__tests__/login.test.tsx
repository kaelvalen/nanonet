import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
}));
jest.mock("../src/store/authStore", () => ({
  useAuthStore: () => ({ isAuthenticated: false, setAuth: jest.fn() }),
}));
jest.mock("../src/api/auth", () => ({
  authApi: { login: jest.fn() },
}));

import LoginScreen from "../app/(auth)/login";

test("renders email and password inputs", () => {
  render(<LoginScreen />);
  expect(screen.getByPlaceholderText("E-posta")).toBeTruthy();
  expect(screen.getByPlaceholderText("Şifre")).toBeTruthy();
  expect(screen.getByText("Giriş yap")).toBeTruthy();
});
