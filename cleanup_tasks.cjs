
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jyoftmysofznrpwnajou.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2Z0bXlzb2Z6bnJwd25ham91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNDgwNTQsImV4cCI6MjA4MTkyNDA1NH0.QFtNgo9Jv93IL5UjbuJvGun1KYa7Kgn4MzIu7uisqOc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log('Starting cleanup of completed tasks...');

    // Check how many completed tasks exist
    const { count, error: countError } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

    if (countError) {
        console.error('Error counting tasks:', countError);
        return;
    }

    console.log(`Found ${count} completed tasks.`);

    if (count === 0) {
        console.log('No completed tasks to delete.');
        return;
    }

    // Delete them
    const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('status', 'completed');

    if (deleteError) {
        console.error('Error deleting tasks:', deleteError);
    } else {
        console.log('Successfully deleted completed tasks.');
    }
}

cleanup();
