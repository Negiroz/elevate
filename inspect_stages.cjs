const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectStages() {
    console.log('Fetching consolidation stages...');
    const { data, error } = await supabase
        .from('consolidation_stages')
        .select('*')
        .order('position');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('\n--- CURRENT STAGES ---');
    data.forEach(stage => {
        console.log(`[${stage.position}] ID: ${stage.id} | Title: "${stage.title}"`);
    });
    console.log('----------------------\n');
}

inspectStages();
