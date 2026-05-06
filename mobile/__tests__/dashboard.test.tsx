import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock("../src/hooks/useWebSocket", () => ({ useWebSocket: jest.fn() }));
jest.mock("../src/api/services", () => ({
  servicesApi: { list: jest.fn() },
}));

import Dashboard from "../app/(app)/index";

test("renders dashboard heading", () => {
  render(<Dashboard />);
  expect(screen.getByText("Dashboard")).toBeTruthy();
});

test("renders status counters", () => {
  render(<Dashboard />);
  expect(screen.getByText("UP")).toBeTruthy();
  expect(screen.getByText("DOWN")).toBeTruthy();
  expect(screen.getByText("DEGRADED")).toBeTruthy();
});
