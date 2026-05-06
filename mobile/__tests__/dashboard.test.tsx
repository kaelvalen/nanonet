import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("../src/store/wsStore", () => ({
  useWsStore: (sel: (s: { connected: boolean }) => unknown) => sel({ connected: false }),
}));
jest.mock("../src/api/services", () => ({
  servicesApi: { list: jest.fn() },
}));

import Dashboard from "../app/(app)/index";

test("renders telemetry heading", () => {
  render(<Dashboard />);
  expect(screen.getByText("NanoNet · Telemetry")).toBeTruthy();
});

test("shows health summary labels", () => {
  render(<Dashboard />);
  expect(screen.getByText("Healthy")).toBeTruthy();
  expect(screen.getByText("Down")).toBeTruthy();
});
