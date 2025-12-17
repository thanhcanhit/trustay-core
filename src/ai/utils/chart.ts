interface BuildQuickChartInput {
	labels: readonly string[];
	datasetLabel: string;
	data: readonly number[];
	type?: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'area' | 'horizontalBar';
	width?: number;
	height?: number;
	backgroundColor?: string[]; // Optional colors for pie/doughnut/radar/polarArea/area charts
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
	const needsColors =
		type === 'pie' ||
		type === 'doughnut' ||
		type === 'radar' ||
		type === 'polarArea' ||
		type === 'area';
	const backgroundColor = input.backgroundColor || (needsColors ? defaultColors : undefined);
	const dataset: any = {
		label: input.datasetLabel,
		data: input.data,
	};
	// Add backgroundColor for pie/doughnut/radar/polarArea/area charts
	if (backgroundColor && needsColors) {
		dataset.backgroundColor = backgroundColor.slice(0, input.data.length);
	}
	// Add borderColor for radar charts
	if (type === 'radar') {
		dataset.borderColor = backgroundColor?.[0] || defaultColors[0];
		dataset.pointBackgroundColor = backgroundColor || defaultColors;
		dataset.pointBorderColor = '#fff';
		dataset.pointHoverBackgroundColor = '#fff';
		dataset.pointHoverBorderColor = backgroundColor?.[0] || defaultColors[0];
	}
	// Add fill and borderColor for area charts
	if (type === 'area') {
		dataset.fill = true;
		dataset.borderColor = backgroundColor?.[0] || defaultColors[0];
		dataset.backgroundColor = backgroundColor?.[0] || defaultColors[0];
		dataset.borderWidth = 2;
	}
	// Handle horizontalBar (Chart.js v2 uses 'horizontalBar', v3 uses 'bar' with indexAxis: 'y')
	const chartType = type === 'horizontalBar' ? 'bar' : type;
	const config: any = {
		type: chartType,
		data: {
			labels: input.labels,
			datasets: [dataset],
		},
		options: { responsive: false, animation: false },
	};
	// Set indexAxis for horizontal bar charts (Chart.js v3+)
	if (type === 'horizontalBar') {
		config.options.indexAxis = 'y';
	}
	// Add specific options for radar charts
	if (type === 'radar') {
		config.options.scales = {
			r: {
				beginAtZero: true,
			},
		};
	}
	const encoded = encodeURIComponent(JSON.stringify(config));
	const url = `https://quickchart.io/chart?width=${width}&height=${height}&chart=${encoded}`;
	return { url, width, height };
}
