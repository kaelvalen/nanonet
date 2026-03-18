import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onReset?: () => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("[ErrorBoundary]", error, info.componentStack);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
		this.props.onReset?.();
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback;

			return (
				<div className="flex items-center justify-center min-h-75 p-6">
					<Card
						className="w-full max-w-md rounded p-6 text-center"
						style={{
							background: "var(--surface-card)",
							border: "2px solid var(--status-down-border)",
							boxShadow: "var(--card-shadow)",
						}}
					>
						<div
							className="w-14 h-14 rounded flex items-center justify-center mx-auto mb-4"
							style={{
								background: "var(--status-down-subtle)",
								border: "2px solid var(--status-down-border)",
							}}
						>
							<AlertTriangle
								className="w-7 h-7"
								style={{ color: "var(--status-down)" }}
							/>
						</div>

						<h2
							className="text-sm font-semibold mb-1"
							style={{ color: "var(--text-secondary)" }}
						>
							Bir Hata Oluştu
						</h2>
						<p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
							Bu bileşen beklenmedik bir hatayla karşılaştı.
						</p>

						{this.state.error?.message && (
							<div
								className="px-3 py-2 rounded text-left mb-4 text-[10px] font-mono break-all"
								style={{
									background: "var(--surface-sunken)",
									border: "1px solid var(--border-default)",
									color: "var(--status-down-text)",
								}}
							>
								{this.state.error.message}
							</div>
						)}

						<div className="flex items-center justify-center gap-2">
							<Button
								size="sm"
								onClick={this.handleReset}
								className="rounded text-xs h-8"
								style={{
									background: "var(--gradient-btn-primary)",
									color: "white",
									boxShadow: "var(--btn-shadow)",
								}}
							>
								<RefreshCw className="w-3 h-3 mr-1" /> Tekrar Dene
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => (window.location.href = "/")}
								className="rounded text-xs h-8"
								style={{
									borderColor: "var(--border-default)",
									color: "var(--text-muted)",
								}}
							>
								<Home className="w-3 h-3 mr-1" /> Ana Sayfa
							</Button>
						</div>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}
