const https = require('https');

const data = JSON.stringify({
    email: 'temp.user123456@gmail.com',
    password: 'password123'
});

const options = {
    hostname: 'jyoftmysofznrpwnajou.supabase.co',
    path: '/auth/v1/signup',
    method: 'POST',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2Z0bXlzb2Z6bnJwd25ham91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNDgwNTQsImV4cCI6MjA4MTkyNDA1NH0.QFtNgo9Jv93IL5UjbuJvGun1KYa7Kgn4MzIu7uisqOc',
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    res.on('data', d => {
        process.stdout.write(d);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
