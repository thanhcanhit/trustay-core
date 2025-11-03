interface BuildQuickChartInput {
	labels: readonly string[];
	datasetLabel: string;
	data: readonly number[];
	type?: 'bar' | 'line' | 'pie' | 'doughnut';
	width?: number;
	height?: number;
}

export function buildQuickChartUrl(input: BuildQuickChartInput): {
	url: string;
	width: number;
	height: number;
} {
	const type = input.type ?? 'bar';
	const width = input.width ?? 800;
	const height = input.height ?? 400;
	const config = {
		type,
		data: {
			labels: input.labels,
			datasets: [
				{
					label: input.datasetLabel,
					data: input.data,
				},
			],
		},
		options: { responsive: false, animation: false },
	};
	const encoded = encodeURIComponent(JSON.stringify(config));
	const url = `https://quickchart.io/chart?width=${width}&height=${height}&chart=${encoded}`;
	return { url, width, height };
}
