import type { AxiosError } from "axios";

export function extractApiError(error: unknown): string {
	const err = error as AxiosError<{ error?: string }>;
	return err?.response?.data?.error ?? "";
}
