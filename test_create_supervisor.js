
async function test() {
    try {
        const response = await fetch('http://localhost:3001/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'supervisor2@test.com',
                password: 'password123',
                data: {
                    first_name: 'Test',
                    last_name: 'Supervisor',
                    role: 'Supervisor de Distrito'
                }
            })
        });

        if (!response.ok) {
            const text = await response.text();
            console.log('Error Response:', text);
        } else {
            const result = await response.json();
            console.log('Success:', result);
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

test();
