import fs from 'fs';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate required environment variables
if (!SUPABASE_URL) {
	console.error('❌ SUPABASE_URL environment variable is required');
	console.log('Please set SUPABASE_URL in your environment or .env file');
	process.exit(1);
}

if (!SUPABASE_KEY) {
	console.error('❌ SUPABASE_KEY environment variable is required');
	console.log('Please set SUPABASE_KEY in your environment or .env file');
	process.exit(1);
}

if (!GEMINI_API_KEY) {
	console.error('❌ GEMINI_API_KEY environment variable is required');
	console.log('Please set GEMINI_API_KEY in your environment or .env file');
	process.exit(1);
}

console.log('✅ Environment variables validated');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function embedText(text) {
	try {
		const result = await ai.models.embedContent({
			model: "gemini-embedding-001",
			contents: text,
		});
		
		if (!result.embeddings || !result.embeddings[0] || !result.embeddings[0].values) {
			throw new Error('Invalid response structure from Gemini API');
		}
		
		return result.embeddings[0].values;
	} catch (error) {
		console.error('Gemini API error:', error.message);
		throw error;
	}
}

async function importSchema() {
	console.log('📖 Reading schema.csv file...');
	const csv = fs.readFileSync(path.join(__dirname, 'data', 'schema.csv'), 'utf8');
	const parsed = Papa.parse(csv, { header: true }).data;
	
	console.log(`📊 Found ${parsed.length} schema entries to process`);
	
	let processed = 0;
	for (const row of parsed) {
		const { table_name, column_name, data_type } = row;
		const text = `${table_name}.${column_name} (${data_type})`;
		
		try {
			console.log(`🔄 Processing ${processed + 1}/${parsed.length}: ${text}`);
			const vector = await embedText(text);

			await supabase.from('schema_embeddings').insert({
				table_name,
				column_name,
				data_type,
				embedding: vector,
			});
			
			processed++;
		} catch (error) {
			console.error(`❌ Error processing ${text}:`, error.message);
			throw error;
		}
	}
	
	console.log(`✅ Successfully processed ${processed} schema entries`);
}

async function main() {
	try {
		console.log('🚀 Starting schema embeddings import...');
		await importSchema();
		console.log('🎉 Schema embeddings import completed successfully!');
	} catch (error) {
		console.error('💥 Script failed:', error.message);
		process.exit(1);
	}
}

main();
