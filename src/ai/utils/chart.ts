interface BuildQuickChartInput {
	labels: readonly string[];
	datasetLabel: string;
	data: readonly number[];
	type?: 'bar' | 'line' | 'pie' | 'doughnut';
	width?: number;
	height?: number;
	backgroundColor?: string[]; // Optional colors for pie/doughnut charts
}

export function buildQuickChartUrl(input: BuildQuickChartInput): {
	url: string;
	width: number;
	height: number;
} {
	const type = input.type ?? 'bar';
	const width = input.width ?? 800;
	const height = input.height ?? 400;
	// Default colors for pie/doughnut charts (if not provided)
	const defaultColors = [
		'#FF6384',
		'#36A2EB',
		'#FFCE56',
		'#4BC0C0',
		'#9966FF',
		'#FF9F40',
		'#FF6384',
		'#C9CBCF',
		'#4BC0C0',
		'#FF6384',
	];
	const backgroundColor =
		input.backgroundColor || (type === 'pie' || type === 'doughnut' ? defaultColors : undefined);
	const dataset: any = {
		label: input.datasetLabel,
		data: input.data,
	};
	// Add backgroundColor for pie/doughnut charts
	if (backgroundColor && (type === 'pie' || type === 'doughnut')) {
		dataset.backgroundColor = backgroundColor.slice(0, input.data.length);
	}
	const config = {
		type,
		data: {
			labels: input.labels,
			datasets: [dataset],
		},
		options: { responsive: false, animation: false },
	};
	const encoded = encodeURIComponent(JSON.stringify(config));
	const url = `https://quickchart.io/chart?width=${width}&height=${height}&chart=${encoded}`;
	return { url, width, height };
}
