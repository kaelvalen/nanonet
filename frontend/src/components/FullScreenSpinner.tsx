export function FullScreenSpinner() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
		</div>
	);
}
